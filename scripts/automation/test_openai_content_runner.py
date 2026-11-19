#!/usr/bin/env python3
"""Local checks for the Responses API content runner. Does not call the live API."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from apply_diff import apply_diff
from content_agent_tools import (
    apply_patch_operation,
    child_environment,
    command_block_reason,
    ensure_public_http_url,
    html_excerpt,
    parse_search_results,
    read_daily_insights,
    read_repository_file,
    run_shell_action,
    ToolError,
)
from openai_content_runner import RunnerConfig, RunnerError, run_agent, tool_definitions

ROOT = Path(__file__).resolve().parents[2]


def git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, stdout=subprocess.DEVNULL)


def init_repo(repo: Path) -> None:
    git(repo, "init", "-b", "main")
    git(repo, "config", "user.email", "test@example.com")
    git(repo, "config", "user.name", "Test")
    (repo / "README.md").write_text("base\n", encoding="utf-8")
    git(repo, "add", "README.md")
    git(repo, "commit", "-m", "base")


class ApplyDiffTests(unittest.TestCase):
    def test_create_and_contextual_update(self) -> None:
        self.assertEqual(apply_diff("", "\n".join(["+hello", "+world", "+"]), mode="create"), "hello\nworld\n")
        self.assertEqual(apply_diff("", "\n".join(["@@", "+hello", "+world"])), "hello\nworld\n")
        crlf = "\r\n".join(["@@", "+hello", "+world"])
        self.assertEqual(apply_diff("", crlf), "hello\r\nworld\r\n")
        updated = apply_diff("line1\nline2\nline3\n", "\n".join(["@@ line1", "-line2", "+updated", " line3"]))
        self.assertEqual(updated, "line1\nupdated\nline3\n")

    def test_two_hunks_do_not_duplicate_the_tail(self) -> None:
        source = "a\nb\nc\nd\n"
        diff = "\n".join(["@@ a", "-b", "+B", " c", "@@ c", "-d", "+D"])
        self.assertEqual(apply_diff(source, diff), "a\nB\nc\nD\n")

    def test_create_rejects_plain_lines(self) -> None:
        with self.assertRaises(ValueError):
            apply_diff("", "plain line", mode="create")


class ToolPolicyTests(unittest.TestCase):
    def test_shell_policy_allows_checks_and_news_publish(self) -> None:
        self.assertIsNone(command_block_reason("git diff --check"))
        self.assertIsNone(command_block_reason("git status --short"))
        self.assertIsNone(command_block_reason("npm run insights:publish -- --file content/2026-11-18-week.json --dry-run"))
        self.assertIsNone(command_block_reason("node scripts/publish-news-edition.mjs --file /tmp/issue.json --publish"))
        self.assertIsNone(command_block_reason("printf ok"))

    def test_shell_policy_blocks_git_history_secrets_and_live_insight_publish(self) -> None:
        for command in (
            "git commit -m 续写",
            "git push origin main",
            "git reset --hard HEAD",
            "gh workflow run deploy",
            "cat .env.local",
            "npm run insights:publish -- --file content/2026-11-18-week.json",
        ):
            self.assertIsNotNone(command_block_reason(command), command)

    def test_child_environment_drops_secrets(self) -> None:
        previous = os.environ.get("OPENAI_API_KEY")
        os.environ["OPENAI_API_KEY"] = "sk-test-example-value"
        try:
            env = child_environment()
        finally:
            if previous is None:
                os.environ.pop("OPENAI_API_KEY", None)
            else:
                os.environ["OPENAI_API_KEY"] = previous
        self.assertNotIn("OPENAI_API_KEY", env)
        self.assertNotIn("sk-test-example-value", " ".join(env.values()))

    def test_public_url_guard(self) -> None:
        for blocked in ("http://127.0.0.1/latest", "http://10.0.0.8/", "http://169.254.169.254/", "http://[::1]/", "file:///etc/passwd"):
            with self.assertRaises(ToolError):
                ensure_public_http_url(blocked)

    def test_html_excerpt_keeps_real_image_urls(self) -> None:
        page = """
        <html><head>
          <title>发布</title>
          <meta property="og:image" content="https://cdn.example.com/photo.jpg" />
          <script>ignore()</script>
        </head><body><img src="/pics/a.png"><p>公司宣布模型开放。</p></body></html>
        """
        excerpt = html_excerpt(page, "https://news.example.com/story", 1000)
        self.assertIn("https://cdn.example.com/photo.jpg", excerpt)
        self.assertIn("https://news.example.com/pics/a.png", excerpt)
        self.assertIn("公司宣布模型开放", excerpt)
        self.assertNotIn("ignore()", excerpt)

    def test_search_parser_unwraps_redirects(self) -> None:
        page = (
            '<a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fnews.example.com%2Fa&amp;rut=1">'
            "公司公告</a>"
        )
        parsed = parse_search_results(page)
        self.assertIn("https://news.example.com/a", parsed)
        self.assertIn("公司公告", parsed)


class WorkspaceToolTests(unittest.TestCase):
    def test_patch_read_shell_and_protected_restore(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            init_repo(repo)
            status, message = apply_patch_operation(
                repo,
                {"type": "create_file", "path": "notes.txt", "diff": "+第一行\n+"},
            )
            self.assertEqual(status, "completed", message)
            self.assertEqual((repo / "notes.txt").read_text(encoding="utf-8"), "第一行\n")
            failed, reason = apply_patch_operation(repo, {"type": "delete_file", "path": "notes.txt"})
            self.assertEqual(failed, "failed")
            self.assertTrue((repo / "notes.txt").is_file())
            denied, _ = apply_patch_operation(
                repo,
                {"type": "create_file", "path": ".github/workflows/evil.yml", "diff": "+name: x\n"},
            )
            self.assertEqual(denied, "failed")
            self.assertIn("第一行", read_repository_file(repo, "notes.txt", 1, 20))

            head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()
            blocked = run_shell_action(repo, {"commands": ["git push origin main"]}, head)
            self.assertEqual(blocked[0]["outcome"]["exit_code"], 126)
            ran = run_shell_action(repo, {"commands": ["printf ok"]}, head)
            self.assertEqual(ran[0]["stdout"].strip(), "ok")
            self.assertEqual(ran[0]["outcome"], {"type": "exit", "exit_code": 0})
            status_out = run_shell_action(repo, {"commands": ["git status --short"]}, head)
            self.assertEqual(status_out[0]["outcome"]["exit_code"], 0)

            (repo / ".env.local").write_text('NEXT_PUBLIC_SUPABASE_URL="https://example.test"\n', encoding="utf-8")
            original = (repo / ".env.local").read_bytes()
            run_shell_action(
                repo,
                {"commands": ['python3 -c \'open(chr(46)+"env.local","w").write("hacked")\'']},
                head,
            )
            self.assertEqual((repo / ".env.local").read_bytes(), original)
            run_shell_action(
                repo,
                {"commands": ["mkdir -p .github/workflows && printf hi > .github/workflows/evil.yml"]},
                head,
            )
            self.assertFalse((repo / ".github/workflows/evil.yml").exists())

    def test_daily_insight_read_hides_the_key(self) -> None:
        class Response:
            status = 200

            def read(self, _limit: int = -1) -> bytes:
                return json.dumps(
                    [{"insight_date": "2026-11-18", "title": "题", "source_label": "出处", "original_language": "zh"}]
                ).encode()

            def __enter__(self) -> "Response":
                return self

            def __exit__(self, *_args: object) -> bool:
                return False

        class Opener:
            def __init__(self) -> None:
                self.request = None

            def open(self, request, timeout: int = 0):  # noqa: ANN001
                self.request = request
                return Response()

        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-signature-value"
            (repo / ".env.local").write_text(
                "NEXT_PUBLIC_SUPABASE_URL="
                + json.dumps("https://example.test")
                + "\nNEXT_PUBLIC_SUPABASE_ANON_KEY="
                + json.dumps(key)
                + "\n",
                encoding="utf-8",
            )
            opener = Opener()
            report = read_daily_insights(repo, "2026-11-18", opener)
        self.assertIn("题", report)
        self.assertNotIn(key, report)
        self.assertIsNotNone(opener.request)
        self.assertNotIn(key, opener.request.full_url)
        self.assertEqual(opener.request.get_header("Apikey"), key)


class RunnerLoopTests(unittest.TestCase):
    def make_config(self, repo: Path, task: str = "jianzhongsheng") -> RunnerConfig:
        output = repo / ".codex-run" / "result.json"
        output.parent.mkdir(parents=True)
        return RunnerConfig(
            task=task,
            prompt="写一则手记，最后只返回 JSON。",
            output_path=output,
            repo=repo,
            model="gpt-6.2-sol",
            effort="high",
            max_turns=4,
            api_key="sk-test-example-value",
            log_path=output.parent / "runner.log",
        )

    def test_shell_then_json_result(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            init_repo(repo)
            config = self.make_config(repo)
            seen: list[dict] = []

            def client(payload: dict, api_key: str) -> dict:
                self.assertEqual(api_key, config.api_key)
                seen.append(payload)
                if len(seen) == 1:
                    return {
                        "id": "resp_1",
                        "status": "completed",
                        "output": [
                            {
                                "type": "shell_call",
                                "call_id": "call_shell",
                                "action": {"commands": ["printf ok"], "max_output_length": 4000},
                            }
                        ],
                    }
                return {
                    "id": "resp_2",
                    "status": "completed",
                    "output": [
                        {
                            "type": "message",
                            "content": [{"type": "output_text", "text": '{"status":"ready","summary_markdown":"写好了"}'}],
                        }
                    ],
                }

            result = run_agent(config, client)
            self.assertEqual(result["status"], "ready")
            self.assertEqual(json.loads(config.output_path.read_text(encoding="utf-8"))["summary_markdown"], "写好了")
            self.assertEqual(seen[1]["previous_response_id"], "resp_1")
            self.assertEqual(seen[1]["input"][0]["type"], "shell_call_output")
            self.assertIn("ok", seen[1]["input"][0]["output"][0]["stdout"])
            self.assertNotIn(config.api_key, config.log_path.read_text(encoding="utf-8"))
            self.assertIn("gpt-6.2-sol", config.log_path.read_text(encoding="utf-8"))

    def test_invalid_json_is_sent_back_for_correction(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            config = self.make_config(repo)
            calls = {"n": 0}

            def client(payload: dict, _api_key: str) -> dict:
                calls["n"] += 1
                if calls["n"] == 1:
                    return {"id": "resp_bad", "status": "completed", "output_text": "还没写完"}
                self.assertIn("无法通过校验", payload["input"][0]["content"])
                return {
                    "id": "resp_ok",
                    "status": "completed",
                    "output_text": '{"status":"failed","summary_markdown":"材料不足"}',
                }

            result = run_agent(config, client)
            self.assertEqual(result["status"], "failed")

    def test_hosted_search_rejection_retries_with_local_search(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            config = self.make_config(repo, task="jiantiandi-news")
            modes: list[list[str]] = []

            def client(payload: dict, _api_key: str) -> dict:
                kinds = [tool.get("type") for tool in payload["tools"]]
                modes.append(kinds)
                if "web_search" in kinds:
                    raise RunnerError("OpenAI API HTTP 400: web_search cannot be combined here")
                self.assertIn("web_search", [tool.get("name") for tool in payload["tools"]])
                return {
                    "id": "resp_local",
                    "status": "completed",
                    "output_text": '{"status":"published","issue_date":"2026-11-18","summary_markdown":"已出刊"}',
                }

            result = run_agent(config, client)
            self.assertEqual(result["status"], "published")
            self.assertEqual(modes[0].count("web_search"), 1)
            self.assertNotIn("web_search", modes[1])

    def test_tool_list_matches_the_job(self) -> None:
        news = tool_definitions("jiantiandi-news", "hosted")
        self.assertIn("web_search", [tool["type"] for tool in news])
        self.assertIn("shell", [tool["type"] for tool in news])
        self.assertIn("apply_patch", [tool["type"] for tool in news])
        insights = tool_definitions("jinri-jianwen", "hosted")
        self.assertIn("read_daily_insights", [tool["name"] for tool in insights if tool["type"] == "function"])
        self.assertNotIn(
            "read_daily_insights",
            [tool.get("name") for tool in tool_definitions("jianzhongsheng", "hosted")],
        )

    def test_turn_limit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            config = self.make_config(repo)
            config.max_turns = 1

            def client(_payload: dict, _api_key: str) -> dict:
                return {"id": "resp_loop", "status": "completed", "output": [{"type": "shell_call", "call_id": "c", "action": {"commands": ["printf ok"]}}]}

            with self.assertRaises(RunnerError):
                run_agent(config, client)


class WorkflowShapeTests(unittest.TestCase):
    def test_removed_codex_action_and_kept_schedules(self) -> None:
        self.assertFalse((ROOT / ".github/actions/codex-exec/action.yml").exists())
        for name in ("jianzhongsheng.yml", "jinri-jianwen.yml", "jiantiandi-news.yml"):
            text = (ROOT / ".github/workflows" / name).read_text(encoding="utf-8")
            self.assertIn("secrets.OPENAI_API_KEY", text)
            self.assertNotIn("TAVILY", text)
            self.assertIn('GITHUB_TOKEN: ""', text)


if __name__ == "__main__":
    unittest.main()
