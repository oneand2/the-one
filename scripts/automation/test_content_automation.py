#!/usr/bin/env python3
"""Local checks for the daily content automation. Does not call the live API or production."""

from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

from content_automation import (
    ContentError,
    assert_patch,
    build_prompt,
    collect_changes,
    find_covering_weeks,
    format_commit,
    load_result,
    parse_date,
    parse_patch_paths,
    redact,
    select_deploy,
    write_env,
)

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = Path(__file__).resolve().parent / "content_automation.py"


def git(repo: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo, check=True, stdout=subprocess.DEVNULL)


def init_repo(repo: Path) -> None:
    git(repo, "init", "-b", "main")
    git(repo, "config", "user.email", "test@example.com")
    git(repo, "config", "user.name", "Test")


def write_result(path: Path, **fields: object) -> None:
    payload = {"summary_markdown": "摘要", **fields}
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


class AutomationTests(unittest.TestCase):
    def test_redact_and_commit_message(self) -> None:
        self.assertIn("[redacted]", redact("token=super-secret-value"))
        self.assertNotIn("super-secret-value", redact("token=super-secret-value"))
        message = format_commit(
            "jianzhongsheng",
            {"commit_message": "token=abc", "titles": ["一张旧票"]},
            "2026-11-18",
        )
        self.assertTrue(message.startswith("见众生：2026-11-18 每日续写"))
        self.assertIn("- 一张旧票", message)

    def test_patch_rejects_deletion_and_foreign_path(self) -> None:
        deleted = textwrap.dedent(
            """\
            diff --git a/src/content/jianzhongsheng.ts b/src/content/jianzhongsheng.ts
            deleted file mode 100644
            """
        )
        with self.assertRaises(ContentError):
            assert_patch("jianzhongsheng", deleted, {"status": "ready"})
        foreign = textwrap.dedent(
            """\
            diff --git a/.github/workflows/deploy-aliyun.yml b/.github/workflows/deploy-aliyun.yml
            new file mode 100644
            """
        )
        with self.assertRaises(ContentError):
            assert_patch("jianzhongsheng", foreign, {"status": "ready"})
        self.assertEqual(parse_patch_paths("") , [])

    def test_select_deploy(self) -> None:
        tip = "a" * 40
        base = {"tip": tip, "sha": tip, "tip_contains_sha": True, "live_contains": False, "runs": []}
        self.assertEqual(select_deploy({**base, "live_contains": True}), "success")
        self.assertEqual(select_deploy(base), "dispatch")
        active = {
            **base,
            "runs": [{"databaseId": 7, "headSha": tip, "status": "in_progress", "url": "https://example.test/run/7"}],
        }
        self.assertEqual(select_deploy(active), "watch 7 https://example.test/run/7")
        failed = {
            **base,
            "dispatched_tip": tip,
            "runs": [{"databaseId": 8, "headSha": tip, "status": "completed", "conclusion": "failure", "url": "https://example.test/run/8", "createdAt": "2026-11-18T00:00:00Z"}],
        }
        self.assertTrue(select_deploy(failed).startswith("fail "))
        self.assertEqual(select_deploy({**base, "tip_contains_sha": False}), "fail origin/main 不包含本次提交")

    def test_write_env_hides_values(self) -> None:
        secret = "https://example.test/abc def#=x"
        with tempfile.TemporaryDirectory() as directory:
            dest = Path(directory) / ".env.local"
            env = os.environ.copy()
            env["NEXT_PUBLIC_SUPABASE_URL"] = secret
            completed = subprocess.run(
                [sys.executable, str(SCRIPT), "write-env", str(dest), "NEXT_PUBLIC_SUPABASE_URL"],
                check=True,
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertNotIn(secret, completed.stdout)
            self.assertNotIn(secret, completed.stderr)
            stored = dest.read_text(encoding="utf-8")
            self.assertEqual(json.loads(stored.split("=", 1)[1]), secret)
            self.assertEqual(stat.S_IMODE(dest.stat().st_mode), 0o600)
            env["NEXT_PUBLIC_SUPABASE_URL"] = "one\ntwo"
            rejected = subprocess.run(
                [sys.executable, str(SCRIPT), "write-env", str(dest), "NEXT_PUBLIC_SUPABASE_URL"],
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertNotEqual(rejected.returncode, 0)
            self.assertNotIn("one\ntwo", rejected.stdout)

    def test_collect_and_apply_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source"
            target = Path(directory) / "target"
            source.mkdir()
            init_repo(source)
            (source / ".gitignore").write_text(".codex-run/\n", encoding="utf-8")
            content = source / "src/content"
            content.mkdir(parents=True)
            note = content / "jianzhongsheng.ts"
            note.write_text("export const value = 1;\n", encoding="utf-8")
            persona = source / "docs"
            persona.mkdir()
            (persona / "jianzhongsheng-personas.md").write_text("old\n", encoding="utf-8")
            git(source, "add", ".")
            git(source, "commit", "-m", "base")
            note.write_text("export const value = 2;\n", encoding="utf-8")
            run_dir = source / ".codex-run"
            run_dir.mkdir()
            result = run_dir / "result.json"
            write_result(result, status="ready", titles=["新标题"])
            patch = run_dir / "changes.patch"
            status = collect_changes("jianzhongsheng", result, patch, source)
            self.assertEqual(status, "ready")
            self.assertIn("jianzhongsheng.ts", patch.read_text(encoding="utf-8"))

            target.mkdir()
            init_repo(target)
            target_content = target / "src/content"
            target_content.mkdir(parents=True)
            (target_content / "jianzhongsheng.ts").write_text("export const value = 1;\n", encoding="utf-8")
            target_docs = target / "docs"
            target_docs.mkdir()
            (target_docs / "jianzhongsheng-personas.md").write_text("old\n", encoding="utf-8")
            git(target, "add", ".")
            git(target, "commit", "-m", "base")
            subprocess.run(["git", "apply", "--index", str(patch)], cwd=target, check=True)
            self.assertIn("value = 2", (target_content / "jianzhongsheng.ts").read_text(encoding="utf-8"))

            (source / "package.json").write_text("{}\n", encoding="utf-8")
            with self.assertRaises(ContentError):
                collect_changes("jianzhongsheng", result, patch, source)

    def test_insights_allowlist_and_failed_status(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            init_repo(repo)
            (repo / ".gitignore").write_text(".codex-run/\n", encoding="utf-8")
            (repo / "README.md").write_text("base\n", encoding="utf-8")
            git(repo, "add", ".")
            git(repo, "commit", "-m", "base")
            run_dir = repo / ".codex-run"
            run_dir.mkdir()
            week = repo / "content/2026-11-18-week.json"
            week.parent.mkdir()
            week.write_text("{}\n", encoding="utf-8")
            svg = repo / "public/daily-insights/2026-11-18.svg"
            svg.parent.mkdir(parents=True)
            svg.write_text("<svg xmlns='http://www.w3.org/2000/svg'/>\n", encoding="utf-8")
            result = run_dir / "result.json"
            write_result(result, status="needs_publish", date="2026-11-18", week_file="content/2026-11-18-week.json")
            patch = run_dir / "changes.patch"
            self.assertEqual(collect_changes("jinri-jianwen", result, patch, repo), "needs_publish")
            paths = [item["path"] for item in parse_patch_paths(patch.read_text(encoding="utf-8"))]
            self.assertEqual(set(paths), {"content/2026-11-18-week.json", "public/daily-insights/2026-11-18.svg"})

            (repo / "package.json").write_text("{}\n", encoding="utf-8")
            write_result(result, status="failed", summary_markdown="写不下去")
            self.assertEqual(collect_changes("jinri-jianwen", result, patch, repo), "failed")
            self.assertEqual(patch.read_text(encoding="utf-8"), "")

    def test_editorial_rules_and_schedules_survive(self) -> None:
        news = (ROOT / ".github/automation/prompts/jiantiandi-news.txt").read_text(encoding="utf-8")
        notes = (ROOT / ".github/automation/prompts/jianzhongsheng.txt").read_text(encoding="utf-8")
        insights = (ROOT / ".github/automation/prompts/jinri-jianwen.txt").read_text(encoding="utf-8")
        for text in (news, notes, insights):
            self.assertNotIn("/home/box", text)
        self.assertIn("每次向 jianZhongShengSpace.entries 末尾新增 2—4 篇完整的虚构手记，不得覆盖或删除旧内容", notes)
        self.assertIn("不得猜测或编造出处与原文", insights)
        self.assertIn("禁止再生成或写入 world_news、news_items", insights)
        self.assertIn("中国四则、外国三则", insights)
        standard = (
            "选题总标准（Bonnie 明确要求，优先于其他偏好）：每条新闻必须满足其一："
            "①对中国普通人的生活、工作、收入、消费、出行、健康、安全等现在有实际影响；"
            "②可预见未来会影响中国普通人（如中国或主要经济体的政策、利率与汇率、贸易与关税、能源与物价、重大科技与 AI 进展、对中国有影响的大公司与市场变化）；"
            "③全球层面非常重要的大事（如战争、重大冲突、重大灾难、大国关系重大转折）。"
            "不收与中国普通人无关的外国地方性新闻，例如外国的天气预警、外国地方福利或就业项目、外国艺术馆展出、外国地方社会新闻等。"
            "中国国内重要新闻同样按此标准选入。不按领域分配数量。"
            "每期篇数硬性下限：头版 1 篇，选读至少 3 篇，短讯至少 3 篇（多则不限）。"
        )
        self.assertIn(standard, news)
        prompt = build_prompt("jiantiandi-news", ROOT / ".github/automation/prompts/jiantiandi-news.txt", "2026-11-18 08:00 CST")
        self.assertIn(standard, prompt)
        self.assertNotIn("/home/box/codex-workspace", prompt)
        workflows = {
            "jianzhongsheng.yml": 'cron: "0 19 * * *"',
            "jinri-jianwen.yml": 'cron: "0 23 * * *"',
            "jiantiandi-news.yml": 'cron: "0 0 * * *"',
        }
        for name, cron in workflows.items():
            text = (ROOT / ".github/workflows" / name).read_text(encoding="utf-8")
            self.assertIn(cron, text)
            self.assertIn("workflow_dispatch:", text)
            self.assertIn("cancel-in-progress: false", text)
            self.assertIn("openai_content_runner.py", text)
            self.assertIn("CONTENT_MODEL: gpt-6.2-sol", text)
            self.assertIn("CONTENT_REASONING_EFFORT: high", text)
            self.assertNotIn("openai/codex-action", text)
            self.assertNotIn("codex-exec", text)
            self.assertNotIn("codex exec", text)
        self.assertFalse((ROOT / ".github/actions/codex-exec/action.yml").exists())
        self.assertIn("不要调用 Codex", prompt)

    def test_real_week_files_do_not_overlap(self) -> None:
        content = ROOT / "content"
        files = sorted(content.glob("*-week.json"))
        self.assertGreaterEqual(len(files), 1)
        covered: dict[str, str] = {}
        for path in files:
            start = parse_date(json.loads(path.read_text(encoding="utf-8"))["startDate"])
            self.assertEqual(path.name, f"{start.isoformat()}-week.json")
            for day in find_covering_weeks(content, start):
                pass
            for offset in range(7):
                day = start.fromordinal(start.toordinal() + offset).isoformat()
                self.assertNotIn(day, covered, f"{day} 被多份周稿覆盖")
                covered[day] = path.name

    def test_load_result_strips_fence(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            path.write_text('```json\n{"status":"ready","summary_markdown":"好"}\n```\n', encoding="utf-8")
            self.assertEqual(load_result(path)["status"], "ready")


if __name__ == "__main__":
    unittest.main()
