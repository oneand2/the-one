#!/usr/bin/env python3
"""Helpers for the daily content GitHub Actions jobs.

The module only prints status fields that have already been shape-checked.
Secret values stay in the environment and are never written to stdout.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import stat
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from zoneinfo import ZoneInfo

STATUSES = {"ready", "already_live", "needs_publish", "published", "failed"}
TASK_STATUSES = {
    "jianzhongsheng": {"ready", "failed"},
    "jinri-jianwen": {"already_live", "needs_publish", "failed"},
    "jiantiandi-news": {"published", "already_live", "failed"},
}
JIAN_PATHS = {"src/content/jianzhongsheng.ts", "docs/jianzhongsheng-personas.md"}
WEEK_FILE = re.compile(r"^content/(\d{4}-\d{2}-\d{2})-week\.json$")
DATE_TEXT = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SHA = re.compile(r"^[0-9a-f]{40}$")
ACTIVE_RUNS = {"queued", "in_progress", "waiting", "requested", "pending"}
FAILED_CONCLUSIONS = {"failure", "cancelled", "timed_out", "startup_failure", "action_required"}
SECRET_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_\-]{8,}"),
    re.compile(r"eyJ[A-Za-z0-9_\-]{20,}"),
    re.compile(r"(?i)(api[_-]?key|secret|token|service_role|authorization|password)\s*[:=]\s*\S+"),
)
PRINTABLE_FIELDS = {"status", "date", "issue_date", "week_file"}


class ContentError(RuntimeError):
    """A content job should stop without publishing."""


def parse_date(value: object) -> dt.date:
    if not isinstance(value, str) or not DATE_TEXT.fullmatch(value):
        raise ContentError(f"日期无效：{value}")
    year, month, day = (int(part) for part in value.split("-"))
    try:
        return dt.date(year, month, day)
    except ValueError as error:
        raise ContentError(f"日期无效：{value}") from error


def week_span(start: dt.date) -> list[dt.date]:
    return [start + dt.timedelta(days=offset) for offset in range(7)]


def load_result(path: Path) -> dict:
    text = path.read_text(encoding="utf-8").strip()
    if text.startswith("```"):
        lines = text.splitlines()[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise ContentError(f"任务结果不是 JSON：{error}") from error
    if not isinstance(data, dict):
        raise ContentError("任务结果不是 JSON 对象")
    status = data.get("status")
    if status not in STATUSES:
        raise ContentError(f"无法识别的 status：{status}")
    summary = data.get("summary_markdown")
    if not isinstance(summary, str) or not summary.strip():
        raise ContentError("summary_markdown 为空")
    return data


def assert_task_status(task: str, result: dict) -> None:
    status = result["status"]
    allowed = TASK_STATUSES.get(task)
    if allowed is None:
        raise ContentError(f"未知任务：{task}")
    if status not in allowed:
        raise ContentError(f"{task} 不能使用 status={status}")
    if task == "jinri-jianwen" and status != "failed":
        parse_date(result.get("date"))
        if status == "needs_publish" or result.get("week_file"):
            insight_allowlist(result)
    if task == "jiantiandi-news" and status != "failed":
        parse_date(result.get("issue_date"))


def insight_allowlist(result: dict) -> tuple[set[str], dt.date, str]:
    today = parse_date(result.get("date"))
    week_file = result.get("week_file")
    match = WEEK_FILE.fullmatch(week_file) if isinstance(week_file, str) else None
    if match is None:
        raise ContentError("week_file 必须是 content/YYYY-MM-DD-week.json")
    start = parse_date(match.group(1))
    span = week_span(start)
    if today not in span:
        raise ContentError("week_file 没有覆盖 date")
    svgs = {f"public/daily-insights/{day.isoformat()}.svg" for day in span}
    return {week_file, *svgs}, today, week_file


def read_week_start(path: Path) -> dt.date:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ContentError(f"{path.name} 不是合法 JSON") from error
    if not isinstance(payload, dict):
        raise ContentError(f"{path.name} 不是周稿对象")
    start = parse_date(payload.get("startDate"))
    expected = path.name.removesuffix("-week.json")
    if expected != start.isoformat():
        raise ContentError(f"{path.name} 的文件名与 startDate 不一致")
    return start


def find_covering_weeks(content_dir: Path, today: dt.date) -> list[Path]:
    matches = []
    for path in sorted(content_dir.glob("*-week.json")):
        if today in week_span(read_week_start(path)):
            matches.append(path)
    return matches


def resolve_week(repo: Path, result: dict) -> tuple[str, str]:
    today = parse_date(result.get("date"))
    matches = find_covering_weeks(repo / "content", today)
    if len(matches) != 1:
        raise ContentError(f"覆盖 {today.isoformat()} 的周稿有 {len(matches)} 份")
    week = matches[0]
    relative = week.relative_to(repo).as_posix()
    stated = result.get("week_file")
    if isinstance(stated, str) and stated != relative:
        raise ContentError(f"week_file 与仓库中的周稿不一致：{stated} / {relative}")
    span = week_span(read_week_start(week))
    for day in span:
        svg = repo / "public" / "daily-insights" / f"{day.isoformat()}.svg"
        if not svg.is_file() or svg.stat().st_size == 0:
            raise ContentError(f"缺少插画 public/daily-insights/{day.isoformat()}.svg")
        try:
            ET.parse(svg)
        except ET.ParseError as error:
            raise ContentError(f"插画 XML 不合法：{svg.name}") from error
    return relative, today.isoformat()


def redact(text: str) -> str:
    for pattern in SECRET_PATTERNS:
        text = pattern.sub("[redacted]", text)
    if len(text) > 8000:
        text = text[:8000] + "\n…（摘要已截断）"
    return text


def commit_subject(task: str, result: dict, today: str) -> str:
    defaults = {
        "jianzhongsheng": f"见众生：{today} 每日续写",
        "jinri-jianwen": f"今日见闻：{today} 周稿",
    }
    default = defaults[task]
    raw = result.get("commit_message")
    if not isinstance(raw, str) or not raw.strip():
        return default
    line = raw.splitlines()[0].strip()
    lowered = line.lower()
    blocked = ("secret", "token", "password", "api_key", "service_role", "begin ")
    if not line or len(line) > 72 or line.startswith("-") or any(word in lowered for word in blocked):
        return default
    return line


def format_commit(task: str, result: dict, today: str) -> str:
    lines = [commit_subject(task, result, today), ""]
    titles = result.get("titles")
    if isinstance(titles, list):
        for title in titles[:12]:
            if isinstance(title, str) and title.strip() and len(title.strip()) <= 80:
                lines.append(f"- {title.strip()}")
    return "\n".join(lines).rstrip() + "\n"


def parse_patch_paths(text: str) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    for line in text.splitlines():
        if line.startswith("diff --git "):
            if current is not None:
                entries.append(current)
            part = line.split(" ")[-1]
            if not part.startswith("b/"):
                raise ContentError(f"无法识别的 diff 路径：{line}")
            current = {"path": part[2:], "deleted": False}
        elif line.startswith("deleted file mode") and current is not None:
            current["deleted"] = True
    if current is not None:
        entries.append(current)
    return entries


def assert_patch(task: str, patch_text: str, result: dict) -> list[str]:
    if patch_text.strip() == "":
        return []
    entries = parse_patch_paths(patch_text)
    if any(entry["deleted"] for entry in entries):
        raise ContentError("补丁包含删除文件，已停止")
    paths = [str(entry["path"]) for entry in entries]
    if any(path.startswith("/") or ".." in Path(path).parts for path in paths):
        raise ContentError("补丁路径越出仓库")
    if task == "jianzhongsheng":
        if "src/content/jianzhongsheng.ts" not in paths or any(path not in JIAN_PATHS for path in paths):
            raise ContentError("见众生补丁只能修改手记和人物档案，且必须包含手记文件")
        return paths
    if task == "jinri-jianwen":
        allow, _, _ = insight_allowlist(result)
        extra = [path for path in paths if path not in allow]
        if extra:
            raise ContentError("今日见闻补丁包含周稿范围之外的文件：" + ", ".join(extra))
        return paths
    raise ContentError(f"任务 {task} 不提交补丁")


def git(cwd: Path, args: list[str], check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(
        ["git", "-c", "core.quotepath=false", *args],
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and result.returncode != 0:
        message = result.stderr.decode("utf-8", "replace").strip() or "git 命令失败"
        raise ContentError(message)
    return result


def split_z(blob: bytes) -> list[str]:
    return [part.decode("utf-8", "surrogateescape") for part in blob.split(b"\0") if part]


def list_changed(cwd: Path) -> list[str]:
    blobs = [
        git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout,
        git(cwd, ["diff", "--name-only", "-z", "HEAD"]).stdout,
        git(cwd, ["diff", "--cached", "--name-only", "-z", "HEAD"]).stdout,
    ]
    seen: list[str] = []
    for blob in blobs:
        for path in split_z(blob):
            if path not in seen:
                seen.append(path)
    return seen


def collect_changes(task: str, result_path: Path, patch_path: Path, cwd: Path) -> str:
    result = load_result(result_path)
    assert_task_status(task, result)
    patch_path.parent.mkdir(parents=True, exist_ok=True)
    if result["status"] == "failed":
        patch_path.write_bytes(b"")
        return "failed"
    changed = list_changed(cwd)
    if task == "jianzhongsheng":
        allow = set(JIAN_PATHS)
        required = {"src/content/jianzhongsheng.ts"}
    elif result["status"] == "already_live":
        if changed:
            raise ContentError("核对为已在线，但工作区有改动：" + ", ".join(changed))
        patch_path.write_bytes(b"")
        return "already_live"
    else:
        allow, _, _ = insight_allowlist(result)
        required = set()
    extra = [path for path in changed if path not in allow]
    if extra:
        raise ContentError("超出本次任务的文件：" + ", ".join(extra))
    missing = [path for path in sorted(required) if path not in changed]
    if missing:
        raise ContentError("缺少必须修改的文件：" + ", ".join(missing))
    if not changed:
        patch_path.write_bytes(b"")
        return str(result["status"])
    untracked = set(split_z(git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]).stdout))
    to_add = [path for path in changed if path in untracked]
    if to_add:
        git(cwd, ["add", "-N", "--", *to_add])
    diff = git(cwd, ["diff", "--binary", "--no-renames", "HEAD", "--", *changed]).stdout
    patch_path.write_bytes(diff)
    assert_patch(task, diff.decode("utf-8", "surrogateescape"), result)
    return str(result["status"])


def cached_paths(cwd: Path) -> list[str]:
    return split_z(git(cwd, ["diff", "--cached", "--name-only", "-z"]).stdout)


def assert_cached_paths(task: str, result: dict, cwd: Path) -> None:
    names = cached_paths(cwd)
    if not names:
        raise ContentError("没有可提交的变更")
    if task == "jianzhongsheng":
        allow = JIAN_PATHS
        if "src/content/jianzhongsheng.ts" not in names:
            raise ContentError("暂存区没有见众生手记")
    elif task == "jinri-jianwen":
        allow, _, _ = insight_allowlist(result)
    else:
        raise ContentError(f"任务 {task} 不提交文件")
    extra = [name for name in names if name not in allow]
    if extra:
        raise ContentError("暂存了任务之外的文件：" + ", ".join(extra))


def select_deploy(state: dict) -> str:
    if not state.get("tip_contains_sha"):
        return "fail origin/main 不包含本次提交"
    if state.get("live_contains"):
        return "success"
    tip = state.get("tip")
    if not isinstance(tip, str) or not SHA.fullmatch(tip):
        return "fail origin/main 的提交编号无效"
    runs = [run for run in state.get("runs", []) if isinstance(run, dict) and run.get("headSha") == tip]
    runs.sort(key=lambda run: str(run.get("createdAt") or ""), reverse=True)
    active = [run for run in runs if run.get("status") in ACTIVE_RUNS]
    if active:
        run = active[0]
        return f"watch {run.get('databaseId')} {run.get('url') or '-'}"
    dispatched = state.get("dispatched_tip") == tip
    if dispatched and not runs:
        return "pending"
    successes = [
        run for run in runs if run.get("status") == "completed" and run.get("conclusion") == "success"
    ]
    if successes and state.get("saw_success_for") != tip:
        run = successes[0]
        return f"wait-health {run.get('databaseId')} {run.get('url') or '-'}"
    if successes and not dispatched:
        return "dispatch"
    if successes:
        return "fail 部署工作流已成功，但线上版本仍未包含本次提交"
    failures = [
        run
        for run in runs
        if run.get("status") == "completed" and run.get("conclusion") in FAILED_CONCLUSIONS
    ]
    if failures and dispatched:
        url = failures[0].get("url") or ""
        return f"fail Deploy to Aliyun 未成功 {url}".strip()
    if dispatched:
        return "pending"
    return "dispatch"


def write_env(dest: Path, names: list[str]) -> None:
    if not names:
        raise ContentError("没有要写入的环境变量")
    lines = []
    for name in names:
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
            raise ContentError(f"拒绝写入的变量名：{name}")
        value = os.environ.get(name)
        if value is None or value == "":
            raise ContentError(f"缺少环境变量 {name}")
        if "\n" in value or "\r" in value or "\x00" in value:
            raise ContentError(f"{name} 含换行，已拒绝写入")
        lines.append(f"{name}={json.dumps(value, ensure_ascii=False)}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    temporary = dest.with_suffix(dest.suffix + ".tmp")
    temporary.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.chmod(temporary, stat.S_IRUSR | stat.S_IWUSR)
    temporary.replace(dest)
    os.chmod(dest, stat.S_IRUSR | stat.S_IWUSR)
    print(f"已写入 {dest.name}（{len(names)} 项，不显示取值）")


def shanghai_clock() -> str:
    return dt.datetime.now(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d %H:%M %Z")


def preface(task: str, clock: str) -> str:
    common = (
        "这是 GitHub Actions 上的无人值守运行。当前工作目录就是仓库根目录，不要使用 /home/box 或其他机器路径。"
        "模型通过 OpenAI Responses API 使用 web_search、fetch_url、read_file、read_daily_insights、本地 shell 和 apply_patch，不要调用 Codex。"
        f"北京时间以系统时钟为准，此刻是 {clock}。"
        "最终消息只能是符合调用方 schema 的 JSON 对象，不要在 JSON 前后附加别的文字。"
        "summary_markdown 用简体中文。不要打印密钥、令牌、环境变量或 .env 内容。"
        "不要修改 .github/workflows、发布脚本、package.json 或锁文件。"
    )
    specific = {
        "jianzhongsheng": "status 只能是 ready 或 failed。",
        "jinri-jianwen": "status 只能是 already_live、needs_publish 或 failed。",
        "jiantiandi-news": (
            "GitHub 计划任务可能晚点启动。《见天地》仍按提示词里的固定截稿窗口，不要因为晚点改窗口。"
            "status 只能是 published、already_live 或 failed。"
        ),
    }[task]
    return common + specific


def build_prompt(task: str, prompt_path: Path, clock: str | None = None) -> str:
    if task not in TASK_STATUSES:
        raise ContentError(f"未知任务：{task}")
    body = prompt_path.read_text(encoding="utf-8").rstrip() + "\n"
    return preface(task, clock or shanghai_clock()) + "\n\n" + body


def append_summary(title: str, lines: list[str], result: dict | None) -> None:
    parts = [f"### {title}", ""]
    parts.extend(redact(line) for line in lines if line)
    repo = os.environ.get("GITHUB_REPOSITORY")
    run_id = os.environ.get("GITHUB_RUN_ID")
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    if repo and run_id:
        parts.append(f"运行：{server}/{repo}/actions/runs/{run_id}")
    if result is not None:
        summary = result.get("summary_markdown")
        if isinstance(summary, str) and summary.strip():
            parts.extend(["", redact(summary.strip())])
    text = "\n".join(parts).rstrip() + "\n"
    destination = os.environ.get("GITHUB_STEP_SUMMARY")
    if destination:
        with open(destination, "a", encoding="utf-8") as handle:
            handle.write(text)
    else:
        sys.stdout.write(text)
    marker = Path(".codex-run/summary-written")
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text("ok\n", encoding="utf-8")


def print_field(result: dict, field: str) -> None:
    if field not in PRINTABLE_FIELDS:
        raise ContentError("拒绝打印该字段")
    value = result.get(field)
    if not isinstance(value, str) or not value.strip() or "\n" in value or "\r" in value:
        raise ContentError(f"缺少或无效的 {field}")
    if field == "status" and value not in STATUSES:
        raise ContentError("status 无效")
    if field in {"date", "issue_date"}:
        parse_date(value)
    if field == "week_file" and WEEK_FILE.fullmatch(value) is None:
        raise ContentError("week_file 无效")
    print(value)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="每日内容自动化辅助命令")
    sub = parser.add_subparsers(dest="command", required=True)

    write = sub.add_parser("write-env")
    write.add_argument("dest")
    write.add_argument("names", nargs="+")

    prompt = sub.add_parser("preface")
    prompt.add_argument("task")
    prompt.add_argument("prompt")
    prompt.add_argument("output")

    collect = sub.add_parser("collect")
    collect.add_argument("task")
    collect.add_argument("result")
    collect.add_argument("patch")

    check = sub.add_parser("assert-result")
    check.add_argument("task")
    check.add_argument("result")

    field = sub.add_parser("print-field")
    field.add_argument("result")
    field.add_argument("field")

    cached = sub.add_parser("assert-cached-paths")
    cached.add_argument("task")
    cached.add_argument("result")

    week = sub.add_parser("print-week")
    week.add_argument("result")

    commit = sub.add_parser("format-commit")
    commit.add_argument("task")
    commit.add_argument("result")
    commit.add_argument("today")

    sub.add_parser("select-deploy")

    summary = sub.add_parser("write-summary")
    summary.add_argument("--title", required=True)
    summary.add_argument("--result")
    summary.add_argument("--line", action="append", default=[])

    args = parser.parse_args(argv)
    try:
        if args.command == "write-env":
            write_env(Path(args.dest), args.names)
        elif args.command == "preface":
            Path(args.output).parent.mkdir(parents=True, exist_ok=True)
            Path(args.output).write_text(build_prompt(args.task, Path(args.prompt)), encoding="utf-8")
        elif args.command == "collect":
            status = collect_changes(args.task, Path(args.result), Path(args.patch), Path.cwd())
            print(status)
        elif args.command == "assert-result":
            result = load_result(Path(args.result))
            assert_task_status(args.task, result)
        elif args.command == "print-field":
            print_field(load_result(Path(args.result)), args.field)
        elif args.command == "assert-cached-paths":
            assert_cached_paths(args.task, load_result(Path(args.result)), Path.cwd())
        elif args.command == "print-week":
            relative, today = resolve_week(Path.cwd(), load_result(Path(args.result)))
            print(relative)
            print(today)
        elif args.command == "format-commit":
            parse_date(args.today)
            sys.stdout.write(format_commit(args.task, load_result(Path(args.result)), args.today))
        elif args.command == "select-deploy":
            print(select_deploy(json.load(sys.stdin)))
        elif args.command == "write-summary":
            result = load_result(Path(args.result)) if args.result and Path(args.result).is_file() else None
            append_summary(args.title, args.line, result)
    except ContentError as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
