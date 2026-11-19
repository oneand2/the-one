#!/usr/bin/env python3
"""Run one daily content job through the OpenAI Responses API.

This replaces Codex for the unattended GitHub Actions jobs. A turn looks like:

1. Send the task prompt to ``POST https://api.openai.com/v1/responses`` with
   ``gpt-6.2-sol`` (override with ``CONTENT_MODEL``) and high reasoning effort.
2. Let the API perform hosted ``web_search`` (live pages, same ``OPENAI_API_KEY``).
3. Execute any local ``shell`` or ``apply_patch`` calls, and the small
   functions ``read_file``, ``fetch_url``, and ``read_daily_insights``.
4. Send the tool outputs back with ``previous_response_id`` until the model
   returns the JSON result the existing publish steps already understand.

The shell inherits no API keys, GitHub tokens, or Supabase secrets. Publishing,
committing, and deploying stay in the workflow steps that run after this one.
Artifacts still land in ``.codex-run`` so the existing collect and publish
scripts do not have to change.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from content_agent_tools import (
    ToolError,
    apply_patch_operation,
    fetch_public_url,
    read_daily_insights,
    read_repository_file,
    run_shell_action,
    search_public_web,
)
from content_automation import ContentError, assert_task_status, load_result, redact

API_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-6.2-sol"
DEFAULT_EFFORT = "high"
EFFORTS = {"none", "low", "medium", "high", "xhigh", "max"}
TRANSIENT_HTTP = {408, 409, 429, 500, 502, 503, 504}

INSTRUCTIONS = """
你在 GitHub 托管的 Ubuntu 运行器上工作。这里调用的是 OpenAI Responses API，不是 Codex，也没有 codex exec。
当前工作目录是仓库根目录。北京时间以系统时区 Asia/Shanghai 为准。

工具：
- web_search：检索并打开公开网页。核验新闻、出处和发布事实时用它。不要编造，不要倒填不在窗口内的消息。
- fetch_url：打开一个公开链接，返回正文摘录和图片地址。配图必须是页面上的真实图片。
- read_file：按行读取仓库里的 UTF-8 文本。
- read_daily_insights：只读核对某一天的 daily_insights 标题和出处。不要自己读取 .env 或拼接密钥。
- shell：本地 bash，可以运行 node、npm、npx、python3、git diff 和 git status。
- apply_patch：按 V4A diff 创建或修改文本文件。删除文件会被拒绝。

限制：
- 不要 git commit、push、reset、rebase，也不要改写历史。提交和部署由后续工作流步骤完成。
- 不要读取、打印或改写 .env、密钥、令牌和环境变量。需要凭据的脚本会自己读取 .env.local。
- 不要修改 .github、package.json、锁文件、发布脚本和这个运行器。
- 今日见闻只能对 insights:publish 使用 --dry-run。正式写入数据库由后续步骤完成。
- 《见天地》用 scripts/publish-news-edition.mjs 预检、带 --publish 签发并回读。不要把刊期提交进 Git。
- 最终消息只能是一个 JSON 对象，字段符合任务说明，不要在 JSON 前后加别的文字。
- summary_markdown 用简体中文。
""".strip()

LOCAL_SEARCH_NOTE = (
    "托管 web_search 当前不可用。请改用名为 web_search 的函数检索公开页面；"
    "如果检索没有结果，用 fetch_url 打开通讯社、公司和监管机构的原始页面。"
)

READ_FILE = {
    "type": "function",
    "name": "read_file",
    "description": "按行读取仓库或 /tmp 中的 UTF-8 文本。offset 从 1 开始，limit 最大 400 行。",
    "strict": True,
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "path": {"type": "string", "description": "相对仓库根目录的路径，或 /tmp 下的绝对路径"},
            "offset": {"type": "integer", "description": "起始行，从 1 开始"},
            "limit": {"type": "integer", "description": "读取行数，1 到 400"},
        },
        "required": ["path", "offset", "limit"],
    },
}
FETCH_URL = {
    "type": "function",
    "name": "fetch_url",
    "description": "打开公开的 http(s) 页面，返回标题、正文摘录和图片 URL。不访问内网。",
    "strict": True,
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "url": {"type": "string", "description": "公开 http 或 https 地址"},
            "max_chars": {"type": "integer", "description": "正文摘录最大字符数，1000 到 30000"},
        },
        "required": ["url", "max_chars"],
    },
}
READ_DAILY = {
    "type": "function",
    "name": "read_daily_insights",
    "description": "只读核对 daily_insights 中某一天的标题和出处。不要用它写入。",
    "strict": True,
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "date": {"type": "string", "description": "北京时间日期，YYYY-MM-DD"},
        },
        "required": ["date"],
    },
}
LOCAL_SEARCH = {
    "type": "function",
    "name": "web_search",
    "description": "在公开网页中检索。托管搜索不可用时的替代。打开具体页面仍用 fetch_url。",
    "strict": True,
    "parameters": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "query": {"type": "string", "description": "检索语句"},
        },
        "required": ["query"],
    },
}


@dataclass
class RunnerConfig:
    task: str
    prompt: str
    output_path: Path
    repo: Path
    model: str
    effort: str
    max_turns: int
    api_key: str
    log_path: Path


class RunnerError(RuntimeError):
    """The runner cannot finish a valid result file."""


Transport = Callable[[dict, str], dict]


def tool_definitions(task: str, search_mode: str) -> list[dict]:
    tools: list[dict] = []
    if search_mode == "hosted":
        tools.append({"type": "web_search"})
    tools.extend(
        [
            {"type": "shell", "environment": {"type": "local"}},
            {"type": "apply_patch"},
            READ_FILE,
            FETCH_URL,
        ]
    )
    if task == "jinri-jianwen":
        tools.append(READ_DAILY)
    if search_mode == "local":
        tools.append(LOCAL_SEARCH)
    return tools


def _object_args(raw: object) -> dict:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ToolError("工具参数不是 JSON 对象")
    return parsed


def _log(config: RunnerConfig, message: str) -> None:
    line = redact(message).replace("\n", " ")
    if len(line) > 500:
        line = line[:500] + "…（日志已截断）"
    print(line, flush=True)
    with config.log_path.open("a", encoding="utf-8") as handle:
        handle.write(line + "\n")


def _function_output(config: RunnerConfig, name: str, arguments: object) -> str:
    try:
        args = _object_args(arguments)
        if name == "read_file":
            return read_repository_file(config.repo, str(args.get("path", "")), int(args.get("offset", 1)), int(args.get("limit", 200)))
        if name == "fetch_url":
            return fetch_public_url(str(args.get("url", "")), int(args.get("max_chars", 12000)))
        if name == "read_daily_insights":
            return read_daily_insights(config.repo, str(args.get("date", "")))
        if name == "web_search":
            return search_public_web(str(args.get("query", "")))
        return f"没有这个本地工具：{name}"
    except (ToolError, ContentError, ValueError, TypeError) as error:
        return redact(str(error))


def _local_outputs(config: RunnerConfig, response: dict, original_head: str | None) -> list[dict]:
    outputs: list[dict] = []
    for item in response.get("output") or []:
        if not isinstance(item, dict):
            continue
        kind = item.get("type")
        call_id = item.get("call_id")
        if kind == "shell_call":
            action = item.get("action") if isinstance(item.get("action"), dict) else {}
            commands = action.get("commands") or action.get("command") or ""
            preview = commands if isinstance(commands, str) else " | ".join(str(part) for part in commands[:4])
            _log(config, f"shell: {preview}")
            outputs.append(
                {
                    "type": "shell_call_output",
                    "call_id": call_id,
                    "max_output_length": action.get("max_output_length") or 16000,
                    "output": run_shell_action(config.repo, action, original_head),
                }
            )
        elif kind == "apply_patch_call":
            operation = item.get("operation") if isinstance(item.get("operation"), dict) else {}
            _log(config, f"apply_patch: {operation.get('type')} {operation.get('path')}")
            status, message = apply_patch_operation(config.repo, operation)
            outputs.append({"type": "apply_patch_call_output", "call_id": call_id, "status": status, "output": message})
        elif kind == "function_call":
            name = str(item.get("name") or "")
            _log(config, f"function: {name}")
            outputs.append({"type": "function_call_output", "call_id": call_id, "output": _function_output(config, name, item.get("arguments"))})
        elif kind not in {"message", "reasoning", "web_search_call"}:
            raise RunnerError(f"运行器没有实现的工具类型：{kind}")
    return outputs


def _message_text(response: dict) -> str:
    parts: list[str] = []
    for item in response.get("output") or []:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        content = item.get("content")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") in {"output_text", "text"}:
                    parts.append(str(block.get("text") or ""))
    if parts:
        return "\n".join(part for part in parts if part).strip()
    text = response.get("output_text")
    return text.strip() if isinstance(text, str) else ""


def _needs_local_work(response: dict) -> bool:
    return any(
        isinstance(item, dict) and item.get("type") in {"shell_call", "apply_patch_call", "function_call"}
        for item in response.get("output") or []
    )


def _validate(task: str, text: str, directory: Path) -> dict:
    candidate = directory / "result.partial.json"
    candidate.write_text(text, encoding="utf-8")
    try:
        result = load_result(candidate)
        assert_task_status(task, result)
    finally:
        candidate.unlink(missing_ok=True)
    return result


def _extract_result(task: str, text: str, directory: Path) -> dict:
    try:
        return _validate(task, text, directory)
    except (ContentError, json.JSONDecodeError):
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return _validate(task, text[start : end + 1], directory)
        raise


def post_responses(payload: dict, api_key: str) -> dict:
    body = json.dumps(payload).encode("utf-8")
    last_error = "OpenAI API 没有返回结果"
    for attempt in range(5):
        request = urllib.request.Request(
            API_URL,
            data=body,
            method="POST",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = redact(error.read().decode("utf-8", "replace")[:2000])
            last_error = f"OpenAI API HTTP {error.code}: {detail}"
            if error.code not in TRANSIENT_HTTP or attempt == 4:
                raise RunnerError(last_error) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            last_error = "无法连接 api.openai.com"
            if attempt == 4:
                raise RunnerError(last_error) from None
        time.sleep(min(2**attempt, 30))
    raise RunnerError(last_error)


def _request(config: RunnerConfig, search_mode: str, previous: str | None, incoming: object) -> dict:
    instructions = INSTRUCTIONS if search_mode == "hosted" else INSTRUCTIONS + "\n" + LOCAL_SEARCH_NOTE
    payload: dict = {
        "model": config.model,
        "reasoning": {"effort": config.effort},
        "instructions": instructions,
        "tools": tool_definitions(config.task, search_mode),
        "tool_choice": "auto",
        "parallel_tool_calls": True,
        "max_output_tokens": 128000,
        "store": True,
    }
    if previous:
        payload["previous_response_id"] = previous
        payload["input"] = incoming
    else:
        payload["input"] = config.prompt if incoming is None else incoming
    return payload


def run_agent(config: RunnerConfig, client: Transport) -> dict:
    if config.task not in {"jianzhongsheng", "jinri-jianwen", "jiantiandi-news"}:
        raise RunnerError(f"未知任务：{config.task}")
    if not config.api_key:
        raise RunnerError("缺少 OPENAI_API_KEY")
    config.log_path.parent.mkdir(parents=True, exist_ok=True)
    config.output_path.parent.mkdir(parents=True, exist_ok=True)
    _log(config, f"开始 {config.task}，模型 {config.model}，推理 {config.effort}，接口 api.openai.com/v1/responses")
    head = _git_head(config.repo)
    search_mode = "hosted"
    previous: str | None = None
    incoming: object = None
    retried_without_hosted_search = False
    for turn in range(1, config.max_turns + 1):
        payload = _request(config, search_mode, previous, incoming)
        try:
            response = client(payload, config.api_key)
        except RunnerError as error:
            if search_mode == "hosted" and not retried_without_hosted_search and "web_search" in str(error).lower():
                retried_without_hosted_search = True
                search_mode = "local"
                previous = None
                incoming = None
                _log(config, "托管 web_search 被接口拒绝，改用同一密钥可完成的本地检索。")
                continue
            raise
        if not isinstance(response, dict):
            raise RunnerError("OpenAI API 返回的不是 JSON 对象")
        status = response.get("status")
        previous = str(response.get("id") or "")
        if not previous:
            raise RunnerError("OpenAI API 响应没有 id")
        _log(config, f"turn {turn} status={status}")
        if _needs_local_work(response):
            try:
                incoming = _local_outputs(config, response, head)
            except ToolError as error:
                raise RunnerError(str(error)) from error
            continue
        if status not in {"completed", "incomplete", None}:
            raise RunnerError(f"模型响应状态为 {status}")
        text = _message_text(response)
        if not text:
            if status == "incomplete":
                raise RunnerError("模型输出被截断，且没有可执行的工具调用")
            raise RunnerError("模型没有返回最终消息")
        try:
            result = _extract_result(config.task, text, config.output_path.parent)
        except (ContentError, json.JSONDecodeError) as error:
            _log(config, f"结果未通过校验：{error}")
            incoming = [
                {
                    "role": "user",
                    "content": "上一条最终消息无法通过校验："
                    + redact(str(error))
                    + "。请只输出修正后的 JSON 对象。",
                }
            ]
            continue
        temporary = config.output_path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(config.output_path)
        _log(config, f"已写入 {config.output_path.name}，status={result['status']}")
        return result
    raise RunnerError(f"超过 {config.max_turns} 轮仍未得到合格结果")


def _git_head(repo: Path) -> str | None:
    import subprocess

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


def _config_from_args(argv: list[str]) -> RunnerConfig:
    parser = argparse.ArgumentParser(description="用 OpenAI Responses API 运行每日内容任务")
    parser.add_argument("--task", required=True, choices=["jianzhongsheng", "jinri-jianwen", "jiantiandi-news"])
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--repo", default=".")
    args = parser.parse_args(argv)
    model = os.environ.get("CONTENT_MODEL", "").strip() or DEFAULT_MODEL
    effort = os.environ.get("CONTENT_REASONING_EFFORT", "").strip() or DEFAULT_EFFORT
    if effort not in EFFORTS:
        raise RunnerError("CONTENT_REASONING_EFFORT 无效")
    try:
        max_turns = int(os.environ.get("CONTENT_MAX_TURNS", "160"))
    except ValueError as error:
        raise RunnerError("CONTENT_MAX_TURNS 无效") from error
    prompt_path = Path(args.prompt)
    output_path = Path(args.output)
    return RunnerConfig(
        task=args.task,
        prompt=prompt_path.read_text(encoding="utf-8"),
        output_path=output_path,
        repo=Path(args.repo).resolve(),
        model=model,
        effort=effort,
        max_turns=max(1, max_turns),
        api_key=os.environ.get("OPENAI_API_KEY", ""),
        log_path=output_path.parent / "runner.log",
    )


def main(argv: list[str]) -> int:
    try:
        result = run_agent(_config_from_args(argv), post_responses)
    except (RunnerError, ContentError, OSError) as error:
        print(redact(str(error)), file=sys.stderr)
        return 1
    print(result["status"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
