#!/usr/bin/env python3
"""Local tools for the daily content Responses API runner.

The model can search and open public pages, read repository files, run a
policy-checked bash, and apply V4A patches. Secrets stay in ``.env.local`` or
the parent environment and are never returned to the model.
"""

from __future__ import annotations

import html
import ipaddress
import json
import os
import re
import signal
import socket
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from apply_diff import apply_diff
from content_automation import parse_date, redact

BROWSER_UA = "JianTiandiContent/1.0 (+https://www.the-one-and-the-two.com; unattended editorial research)"
MAX_WRITE_BYTES = 2_000_000
FETCH_BYTES = 500_000
PROTECTED_PREFIXES = (".github/", ".git/", "node_modules/")
PROTECTED_EXACT = {
    "package.json",
    "package-lock.json",
    ".env",
    ".env.local",
    "scripts/automation/openai_content_runner.py",
    "scripts/automation/content_agent_tools.py",
    "scripts/automation/apply_diff.py",
    "scripts/automation/content_automation.py",
    "scripts/automation/git-publish.sh",
    "scripts/automation/publish-jianzhongsheng.sh",
    "scripts/automation/publish-insights.sh",
    "scripts/automation/verify-news-job.sh",
    "scripts/automation/wait-for-deploy.sh",
    "scripts/publish-news-edition.mjs",
    "scripts/publish-daily-insights.ts",
}
GIT_FORBIDDEN = re.compile(
    r"\bgit\b(?:\s+-c\s+\S+|\s+-[A-Za-z]+|\s+--[A-Za-z0-9-]+)*\s+"
    r"(commit|push|pull|fetch|reset|checkout|switch|restore|clean|rebase|merge|cherry-pick|"
    r"add|rm|mv|stash|tag|update-ref|config|remote|clone|init|am|apply|filter-branch|"
    r"commit-tree|update-index)\b",
    re.IGNORECASE,
)
SECRET_IN_COMMAND = (
    re.compile(r"sk-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"eyJ[A-Za-z0-9_\-]{20,}"),
)
ENV_DROP_PARTS = ("SECRET", "TOKEN", "PASSWORD", "API_KEY", "SERVICE_ROLE", "CREDENTIAL")


class ToolError(RuntimeError):
    """A tool call failed in a way the model can correct."""


def is_protected_path(relative: str) -> bool:
    rel = relative.replace("\\", "/").strip()
    while rel.startswith("./"):
        rel = rel[2:]
    name = Path(rel).name
    if rel in PROTECTED_EXACT or rel.startswith(PROTECTED_PREFIXES):
        return True
    return name == ".env" or name.startswith(".env.")


def command_block_reason(command: str) -> str | None:
    if not command.strip():
        return "命令是空的"
    if len(command) > 400_000:
        return "命令过长"
    if GIT_FORBIDDEN.search(command):
        return "拒绝 commit、push、reset 或其他会改写 Git 状态的命令。文件用 apply_patch 修改，提交由后续步骤完成。"
    if re.search(r"\b(gh|hub|sudo|doas)\b", command):
        return "拒绝 gh、hub 和 sudo"
    if any(pattern.search(command) for pattern in SECRET_IN_COMMAND):
        return "命令里含有疑似密钥，已拒绝执行"
    if re.search(r"(?:^|[\s'\"=])\.env(?:\b|\.)|/\.env", command):
        return "不要读取或改写 .env。核对 daily_insights 用 read_daily_insights；出刊脚本会自己读 .env.local。"
    if re.search(r"/proc/(?:self|\d+)/environ", command) or re.search(
        r"(?:^|[;&|(`])\s*(?:printenv|env|set)\b", command
    ):
        return "不要打印环境变量"
    if re.search(r"\bcurl\b[^|\n]*\|\s*(?:sh|bash|zsh)\b", command):
        return "拒绝把下载内容直接送进 shell"
    if re.search(r"\brm\b", command) and re.search(r"(?:^|\s)/(?:\s|$)", command):
        return "拒绝删除根目录"
    if ("insights:publish" in command or "publish-daily-insights" in command) and "--dry-run" not in command:
        return "今日见闻的正式入库由后续步骤执行。这里只能运行带 --dry-run 的校验。"
    return None


def child_environment() -> dict[str, str]:
    env = os.environ.copy()
    for key in list(env):
        upper = key.upper()
        if any(part in upper for part in ENV_DROP_PARTS):
            env.pop(key, None)
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["GIT_CONFIG_GLOBAL"] = "/dev/null"
    env["GIT_CONFIG_NOSYSTEM"] = "1"
    return env


def _within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False
    return True


def _allowed(path: Path, repo: Path, tmp: Path) -> bool:
    return path == repo or path == tmp or _within(path, repo) or _within(path, tmp)


def resolve_inside(repo: Path, raw: str) -> Path:
    if not isinstance(raw, str) or not raw.strip() or "\x00" in raw:
        raise ToolError("路径无效")
    path = Path(raw)
    if not path.is_absolute():
        if ".." in path.parts:
            raise ToolError("路径不能包含 ..")
        path = repo / path
    root = repo.resolve()
    tmp = Path("/tmp").resolve()
    if path.exists() and path.is_symlink():
        raise ToolError("拒绝通过符号链接访问该路径")
    final = path.resolve()
    if not _allowed(final, root, tmp):
        raise ToolError("路径越出仓库和 /tmp")
    return final


def repo_relative(repo: Path, target: Path) -> str | None:
    try:
        return target.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError:
        return None


def assert_readable(repo: Path, target: Path) -> None:
    relative = repo_relative(repo, target)
    if relative is None and not _within(target, Path("/tmp").resolve()):
        raise ToolError("只能读取仓库或 /tmp 里的文件")
    if target.name == ".env" or target.name.startswith(".env.") or relative in {".git"} or (
        relative is not None and relative.startswith(".git/")
    ):
        raise ToolError("拒绝读取该文件")


def assert_writable(repo: Path, target: Path) -> None:
    relative = repo_relative(repo, target)
    if relative is None:
        if not _within(target, Path("/tmp").resolve()):
            raise ToolError("只能写入仓库或 /tmp")
        return
    if is_protected_path(relative):
        raise ToolError(f"拒绝修改 {relative}")


def read_repository_file(repo: Path, path: str, offset: int, limit: int) -> str:
    target = resolve_inside(repo, path)
    assert_readable(repo, target)
    if not target.is_file():
        raise ToolError("文件不存在")
    try:
        lines = target.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError as error:
        raise ToolError("文件不是 UTF-8 文本") from error
    start = max(1, int(offset))
    count = min(max(1, int(limit)), 400)
    selected = lines[start - 1 : start - 1 + count]
    if not selected:
        return f"{path} 共 {len(lines)} 行，从第 {start} 行起没有内容"
    numbered = "\n".join(f"{start + index}|{line}" for index, line in enumerate(selected))
    if len(numbered) > 80_000:
        numbered = numbered[:80_000] + "\n…（已截断）"
    last = start + len(selected) - 1
    return f"{path} 共 {len(lines)} 行，显示 {start}-{last}\n{numbered}"


def apply_patch_operation(repo: Path, operation: dict) -> tuple[str, str]:
    kind = operation.get("type")
    raw_path = operation.get("path")
    if not isinstance(raw_path, str):
        return "failed", "apply_patch 缺少 path"
    try:
        target = resolve_inside(repo, raw_path)
        assert_writable(repo, target)
        if kind == "delete_file":
            return "failed", "本任务不允许删除文件"
        if operation.get("move_to"):
            return "failed", "本任务不允许移动文件"
        diff = operation.get("diff")
        if not isinstance(diff, str):
            return "failed", "apply_patch 缺少 diff"
        if kind == "create_file":
            if target.exists():
                return "failed", "文件已存在，请改用 update_file"
            content = apply_diff("", diff, mode="create")
        elif kind == "update_file":
            if not target.is_file():
                return "failed", "文件不存在，请改用 create_file"
            content = apply_diff(target.read_text(encoding="utf-8"), diff)
        else:
            return "failed", f"无法识别的 apply_patch 操作：{kind}"
        encoded = content.encode("utf-8")
        if len(encoded) > MAX_WRITE_BYTES:
            return "failed", "写入内容超过 2MB"
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + ".agent-tmp")
        temporary.write_bytes(encoded)
        temporary.replace(target)
    except (ToolError, ValueError, OSError, UnicodeError) as error:
        return "failed", redact(str(error))
    verb = "已创建" if kind == "create_file" else "已更新"
    return "completed", f"{verb} {raw_path}"


def _clamp_output_limit(value: object) -> int:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        number = 16_000
    return min(max(number, 2_000), 100_000)


def _command_timeout(command: str, requested_ms: object) -> float:
    sleep = re.fullmatch(r"sleep\s+(\d+)", command.strip())
    if sleep:
        return min(int(sleep.group(1)), 3600) + 5
    try:
        seconds = float(requested_ms) / 1000 if requested_ms else 180  # type: ignore[arg-type]
    except (TypeError, ValueError):
        seconds = 180
    if seconds <= 0:
        seconds = 180
    return min(seconds, 1200)


def _run_bash(repo: Path, command: str, timeout: float, cwd: Path) -> tuple[str, str, dict]:
    process = subprocess.Popen(
        ["bash", "--noprofile", "--norc", "-c", command],
        cwd=cwd,
        env=child_environment(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    try:
        stdout, stderr = process.communicate(timeout=timeout)
        code = process.returncode if process.returncode is not None else 1
        return stdout, stderr, {"type": "exit", "exit_code": code}
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        stdout, stderr = process.communicate()
        return stdout or "", stderr or "", {"type": "timeout"}


def _limit_text(text: str, limit: int) -> str:
    cleaned = redact(text)
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit] + "\n…（输出已截断）"


def _git_head(repo: Path) -> str | None:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=repo,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None


def _snapshot_env_files(repo: Path) -> dict[str, bytes | None]:
    snapshot: dict[str, bytes | None] = {}
    for name in (".env", ".env.local", ".env.production"):
        path = repo / name
        snapshot[name] = path.read_bytes() if path.is_file() else None
    return snapshot


def _restore_policy_files(repo: Path, original_head: str | None, env_snapshot: dict[str, bytes | None]) -> str:
    notes: list[str] = []
    head = _git_head(repo)
    if original_head and head and head != original_head:
        reset = subprocess.run(
            ["git", "reset", "--soft", original_head],
            cwd=repo,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        if reset.returncode != 0:
            raise ToolError("工作区 Git 头被改动且无法还原，已停止")
        notes.append("已撤销提交，改动留在工作区。不要再 commit 或 push。")
    status = subprocess.run(
        ["git", "status", "--porcelain", "-uall"],
        cwd=repo,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if status.returncode == 0:
        for line in status.stdout.splitlines():
            raw = line[3:] if len(line) > 3 else ""
            path = raw.split(" -> ")[-1].strip().strip('"')
            if path and is_protected_path(path):
                tracked = subprocess.run(
                    ["git", "ls-files", "--error-unmatch", "--", path],
                    cwd=repo,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
                if tracked.returncode == 0:
                    subprocess.run(
                        ["git", "restore", "--source=HEAD", "--staged", "--worktree", "--", path],
                        cwd=repo,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        check=False,
                    )
                else:
                    target = repo / path
                    if target.is_file() and not target.is_symlink():
                        target.unlink()
                notes.append(f"已还原不允许修改的文件：{path}")
    for name, previous in env_snapshot.items():
        path = repo / name
        current = path.read_bytes() if path.is_file() else None
        if current == previous:
            continue
        if previous is None:
            if path.is_file() and not path.is_symlink():
                path.unlink()
        else:
            path.write_bytes(previous)
        notes.append(f"已还原 {name}")
    return "\n".join(notes)


def run_shell_action(repo: Path, action: dict, original_head: str | None) -> list[dict]:
    commands = action.get("commands")
    if isinstance(commands, str):
        commands = [commands]
    if not isinstance(commands, list) or not commands:
        single = action.get("command")
        commands = [single] if isinstance(single, str) else []
    if not commands:
        return [{"stdout": "", "stderr": "shell 调用没有命令", "outcome": {"type": "exit", "exit_code": 126}}]
    try:
        cwd = resolve_inside(repo, action["working_directory"]) if action.get("working_directory") else repo.resolve()
        if not cwd.is_dir():
            raise ToolError("工作目录不存在")
    except ToolError as error:
        return [{"stdout": "", "stderr": str(error), "outcome": {"type": "exit", "exit_code": 126}}]
    limit = _clamp_output_limit(action.get("max_output_length"))
    outputs: list[dict] = []
    stopped = False
    for raw in commands[:8]:
        command = raw if isinstance(raw, str) else ""
        if stopped:
            outputs.append({"stdout": "", "stderr": "前一条命令被拒绝，后续命令未执行", "outcome": {"type": "exit", "exit_code": 126}})
            continue
        reason = command_block_reason(command)
        if reason:
            outputs.append({"stdout": "", "stderr": reason, "outcome": {"type": "exit", "exit_code": 126}})
            stopped = True
            continue
        env_snapshot = _snapshot_env_files(repo)
        stdout, stderr, outcome = _run_bash(repo, command, _command_timeout(command, action.get("timeout_ms")), cwd)
        note = _restore_policy_files(repo, original_head, env_snapshot)
        if note:
            stderr = (stderr + "\n" + note).strip()
        outputs.append({"stdout": _limit_text(stdout, limit), "stderr": _limit_text(stderr, limit), "outcome": outcome})
    if len(commands) > 8:
        outputs.append({"stdout": "", "stderr": "一次 shell 调用最多 8 条命令", "outcome": {"type": "exit", "exit_code": 126}})
    return outputs


def ensure_public_http_url(value: str) -> str:
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ToolError("只接受不带账号的 http 或 https 地址")
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        literal = ipaddress.ip_address(host)
        addresses = [literal]
    except ValueError:
        try:
            infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except socket.gaierror as error:
            raise ToolError("无法解析主机") from error
        addresses = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not addresses or any(not address.is_global for address in addresses):
        raise ToolError("拒绝访问非公网地址")
    return value


class _PublicRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        ensure_public_http_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _opener() -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(_PublicRedirectHandler)


def html_excerpt(page: str, page_url: str, max_chars: int) -> str:
    images: list[str] = []
    for match in re.finditer(r"<meta\b[^>]*>", page, flags=re.IGNORECASE):
        tag = match.group(0)
        if not re.search(r"(?:property|name)\s*=\s*['\"](?:og:image|twitter:image)(?:[:'\"]|$)", tag, re.IGNORECASE):
            continue
        content = re.search(r"content\s*=\s*['\"]([^'\"]+)['\"]", tag, re.IGNORECASE)
        if content:
            images.append(urllib.parse.urljoin(page_url, html.unescape(content.group(1))))
    for src in re.findall(r"<img\b[^>]*\bsrc\s*=\s*['\"]([^'\"]+)['\"]", page, flags=re.IGNORECASE):
        if not src.startswith("data:"):
            images.append(urllib.parse.urljoin(page_url, html.unescape(src)))
    title_match = re.search(r"<title[^>]*>(.*?)</title>", page, flags=re.IGNORECASE | re.DOTALL)
    title = html.unescape(re.sub(r"\s+", " ", title_match.group(1))).strip() if title_match else ""
    text = re.sub(r"(?is)<(script|style|noscript)\b[^>]*>.*?</\1>", " ", page)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", html.unescape(text)).strip()
    unique: list[str] = []
    for image in images:
        if image.startswith("http") and image not in unique:
            unique.append(image)
        if len(unique) == 12:
            break
    body = text[:max_chars]
    lines = [f"url: {page_url}"]
    if title:
        lines.append(f"title: {title}")
    if unique:
        lines.append("images:")
        lines.extend(f"- {image}" for image in unique)
    lines.append("text:")
    lines.append(body or "（页面没有提取到正文）")
    if len(text) > max_chars:
        lines.append("…（正文已截断）")
    return "\n".join(lines)


def fetch_public_url(url: str, max_chars: int = 12_000, opener: urllib.request.OpenerDirector | None = None) -> str:
    ensure_public_http_url(url)
    limit = min(max(1_000, int(max_chars)), 30_000)
    request = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA, "Accept": "text/html,application/json;q=0.9,*/*;q=0.8"})
    try:
        with (opener or _opener()).open(request, timeout=25) as response:
            final_url = response.geturl()
            ensure_public_http_url(final_url)
            payload = response.read(FETCH_BYTES + 1)
            content_type = response.headers.get("Content-Type", "")
    except ToolError:
        raise
    except Exception as error:
        raise ToolError(f"打开页面失败：{error.__class__.__name__}") from error
    if len(payload) > FETCH_BYTES:
        payload = payload[:FETCH_BYTES]
    charset = "utf-8"
    matched = re.search(r"charset=([\w.-]+)", content_type, re.IGNORECASE)
    if matched:
        charset = matched.group(1)
    text = payload.decode(charset, "replace")
    if "html" not in content_type.lower() and not text.lstrip().startswith("<"):
        clipped = text[:limit]
        suffix = "\n…（已截断）" if len(text) > limit else ""
        return f"url: {final_url}\n{clipped}{suffix}"
    return html_excerpt(text, final_url, limit)


def load_env_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, raw = line.split("=", 1)
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
            continue
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, str):
            values[name] = parsed
    return values


def read_daily_insights(repo: Path, date: str, opener: urllib.request.OpenerDirector | None = None) -> str:
    parse_date(date)
    env = load_env_file(repo / ".env.local")
    base = env.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    if not base or not key:
        return "缺少 Supabase 只读配置，无法核对 daily_insights。"
    query = urllib.parse.urlencode(
        {
            "insight_date": f"eq.{date}",
            "select": "insight_date,title,source_label,original_language",
            "limit": "5",
        }
    )
    request = urllib.request.Request(
        base.rstrip("/") + "/rest/v1/daily_insights?" + query,
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    try:
        with (opener or _opener()).open(request, timeout=25) as response:
            payload = response.read(200_000)
            status = getattr(response, "status", 200)
    except Exception as error:
        return f"读取 daily_insights 失败：{error.__class__.__name__}"
    try:
        rows = json.loads(payload.decode("utf-8", "replace"))
    except json.JSONDecodeError:
        return f"读取 daily_insights 失败：HTTP {status}"
    if not isinstance(rows, list):
        return f"读取 daily_insights 失败：HTTP {status}"
    cleaned = []
    for row in rows[:5]:
        if not isinstance(row, dict):
            continue
        cleaned.append(
            {
                "insight_date": row.get("insight_date"),
                "title": row.get("title"),
                "source_label": row.get("source_label"),
                "original_language": row.get("original_language"),
            }
        )
    return json.dumps({"date": date, "count": len(cleaned), "rows": cleaned}, ensure_ascii=False)


def parse_search_results(page: str) -> str:
    results: list[str] = []
    for match in re.finditer(
        r'<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
        page,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        href, title_html = match.group(1), match.group(2)
        parsed = urllib.parse.urlparse(html.unescape(href))
        query = urllib.parse.parse_qs(parsed.query)
        if "uddg" in query:
            href = query["uddg"][0]
        title = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", title_html))).strip()
        if href.startswith("http") and title:
            results.append(f"- {title}\n  {href}")
        if len(results) == 8:
            break
    if not results:
        return "没有解析到搜索结果。请改用 fetch_url 打开已知的权威来源页面。"
    return "搜索结果：\n" + "\n".join(results)


def search_public_web(query: str, opener: urllib.request.OpenerDirector | None = None) -> str:
    text = query.strip()
    if not text:
        return "查询为空"
    if len(text) > 300:
        text = text[:300]
    data = urllib.parse.urlencode({"q": text}).encode()
    request = urllib.request.Request(
        "https://html.duckduckgo.com/html/",
        data=data,
        headers={"User-Agent": BROWSER_UA, "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with (opener or _opener()).open(request, timeout=25) as response:
            page = response.read(FETCH_BYTES).decode("utf-8", "replace")
    except Exception as error:
        return f"本地检索失败：{error.__class__.__name__}。请改用 fetch_url 打开已知来源。"
    return parse_search_results(page)
