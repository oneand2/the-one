#!/usr/bin/env python3
"""Apply Responses API V4A diffs locally.

The grammar matches the hosted ``apply_patch`` tool: create-file diffs are
lines prefixed with ``+``, and updates use ``@@`` hunks with space, ``+``, and
``-`` prefixes. This file is intentionally dependency-free so the daily jobs
can run it with the system Python on GitHub-hosted runners.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Literal

ApplyDiffMode = Literal["default", "create"]

END_PATCH = "*** End Patch"
END_FILE = "*** End of File"
SECTION_TERMINATORS = (
    END_PATCH,
    "*** Update File:",
    "*** Delete File:",
    "*** Add File:",
)
END_SECTION_MARKERS = (*SECTION_TERMINATORS, END_FILE)


@dataclass
class Chunk:
    orig_index: int
    del_lines: list[str]
    ins_lines: list[str]


@dataclass
class ParserState:
    lines: list[str]
    index: int = 0
    fuzz: int = 0


@dataclass
class ReadSectionResult:
    next_context: list[str]
    section_chunks: list[Chunk]
    end_index: int
    eof: bool


def apply_diff(source: str, diff: str, mode: ApplyDiffMode = "default") -> str:
    """Apply a V4A diff. ``mode='create'`` requires every line to start with ``+``."""
    newline = _detect_newline(source, diff, mode)
    diff_lines = _normalize_diff_lines(diff)
    if mode == "create":
        return _parse_create_diff(diff_lines, newline)
    parsed = _parse_update_diff(diff_lines, source.replace("\r\n", "\n"))
    return _apply_chunks(source.replace("\r\n", "\n"), parsed, newline)


def _normalize_diff_lines(diff: str) -> list[str]:
    lines = [line.rstrip("\r") for line in re.split(r"\r?\n", diff)]
    if lines and lines[-1] == "":
        lines.pop()
    return lines


def _detect_newline(source: str, diff: str, mode: ApplyDiffMode) -> str:
    sample = diff if mode == "create" or "\n" not in source else source
    return "\r\n" if "\r\n" in sample else "\n"


def _is_done(state: ParserState, prefixes: Sequence[str]) -> bool:
    if state.index >= len(state.lines):
        return True
    current = state.lines[state.index]
    return any(current.startswith(prefix) for prefix in prefixes)


def _read_str(state: ParserState, prefix: str) -> str:
    if state.index >= len(state.lines):
        return ""
    current = state.lines[state.index]
    if current.startswith(prefix):
        state.index += 1
        return current[len(prefix) :]
    return ""


def _parse_create_diff(lines: list[str], newline: str) -> str:
    parser = ParserState(lines=[*lines, END_PATCH])
    output: list[str] = []
    while not _is_done(parser, SECTION_TERMINATORS):
        line = parser.lines[parser.index]
        parser.index += 1
        if not line.startswith("+"):
            raise ValueError(f"新建文件的 diff 每行都必须以 + 开头：{line}")
        output.append(line[1:])
    return newline.join(output)


def _parse_update_diff(lines: list[str], source: str) -> list[Chunk]:
    parser = ParserState(lines=[*lines, END_PATCH])
    source_lines = source.split("\n")
    chunks: list[Chunk] = []
    cursor = 0
    while not _is_done(parser, END_SECTION_MARKERS):
        anchors, anchor_count = _read_anchors(parser)
        if anchor_count == 0 and cursor != 0:
            current = parser.lines[parser.index] if parser.index < len(parser.lines) else ""
            raise ValueError(f"无法识别的 diff 行：{current}")
        for index, anchor in enumerate(anchors):
            cursor = _advance_to_anchor(
                anchor,
                source_lines,
                cursor,
                parser,
                require_match=anchor_count > 1,
                force_forward=index > 0,
            )
        section = _read_section(parser.lines, parser.index)
        match_at, fuzz = _find_context(source_lines, section.next_context, cursor, section.eof)
        if match_at < 0:
            context = "\n".join(section.next_context)
            where = "文件结尾" if section.eof else str(cursor)
            raise ValueError(f"找不到对应上下文（{where}）：\n{context}")
        parser.fuzz += fuzz
        parser.index = section.end_index
        cursor = match_at + len(section.next_context)
        for chunk in section.section_chunks:
            chunks.append(
                Chunk(
                    orig_index=chunk.orig_index + match_at,
                    del_lines=list(chunk.del_lines),
                    ins_lines=list(chunk.ins_lines),
                )
            )
    return chunks


def _read_anchors(parser: ParserState) -> tuple[list[str], int]:
    anchors: list[str] = []
    count = 0
    while True:
        start = parser.index
        anchor = _read_str(parser, "@@ ")
        consumed = parser.index != start
        if not consumed and parser.index < len(parser.lines) and parser.lines[parser.index] == "@@":
            parser.index += 1
            consumed = True
        if not consumed:
            break
        count += 1
        if anchor.strip():
            anchors.append(anchor)
    return anchors, count


def _advance_to_anchor(
    anchor: str,
    source_lines: list[str],
    cursor: int,
    parser: ParserState,
    *,
    require_match: bool,
    force_forward: bool,
) -> int:
    found = _seek(source_lines, cursor, anchor, lambda line: line, force_forward)
    if found is None:
        found = _seek(source_lines, cursor, anchor.strip(), lambda line: line.strip(), force_forward)
        if found is not None:
            parser.fuzz += 1
    if found is None:
        if require_match:
            raise ValueError(f"找不到锚点：{anchor}")
        return cursor
    return found


def _seek(
    source_lines: list[str],
    cursor: int,
    expected: str,
    normalize: Callable[[str], str],
    force_forward: bool,
) -> int | None:
    if not force_forward and any(normalize(line) == expected for line in source_lines[:cursor]):
        return cursor
    for index in range(cursor, len(source_lines)):
        if normalize(source_lines[index]) == expected:
            return index + 1
    return None


def _read_section(lines: list[str], start: int) -> ReadSectionResult:
    context: list[str] = []
    deleted: list[str] = []
    inserted: list[str] = []
    chunks: list[Chunk] = []
    mode: Literal["keep", "add", "delete"] = "keep"
    index = start

    def flush() -> None:
        nonlocal deleted, inserted
        if deleted or inserted:
            chunks.append(Chunk(len(context) - len(deleted), list(deleted), list(inserted)))
            deleted = []
            inserted = []

    while index < len(lines):
        raw = lines[index]
        if raw.startswith(("@@", "***")) or raw == END_FILE:
            if raw.startswith("***") and raw not in END_SECTION_MARKERS and not raw.startswith(
                ("*** Update File:", "*** Delete File:", "*** Add File:", END_PATCH, END_FILE)
            ):
                raise ValueError(f"无法识别的 diff 行：{raw}")
            break
        index += 1
        line = raw if raw else " "
        prefix, content = line[0], line[1:]
        if prefix == "+":
            new_mode: Literal["keep", "add", "delete"] = "add"
        elif prefix == "-":
            new_mode = "delete"
        elif prefix == " ":
            new_mode = "keep"
        else:
            raise ValueError(f"无法识别的 diff 行：{line}")
        if new_mode == "keep" and mode != "keep":
            flush()
        mode = new_mode
        if mode == "delete":
            deleted.append(content)
            context.append(content)
        elif mode == "add":
            inserted.append(content)
        else:
            context.append(content)
    flush()
    if index == start:
        current = lines[index] if index < len(lines) else ""
        raise ValueError(f"diff 片段是空的：{current}")
    eof = index < len(lines) and lines[index] == END_FILE
    return ReadSectionResult(context, chunks, index + 1 if eof else index, eof)


def _find_context(lines: list[str], context: list[str], start: int, eof: bool) -> tuple[int, int]:
    if eof:
        searchable = lines[:-1] if lines and lines[-1] == "" else lines
        end_start = max(0, len(searchable) - len(context))
        found, fuzz = _find_context_core(searchable, context, end_start)
        if found >= 0:
            return found, fuzz
        fallback, fallback_fuzz = _find_context_core(searchable, context, min(start, len(searchable)))
        return fallback, fallback_fuzz + 10000
    return _find_context_core(lines, context, start)


def _find_context_core(lines: list[str], context: list[str], start: int) -> tuple[int, int]:
    if not context:
        return start, 0
    for fuzz, normalize in (
        (0, lambda value: value),
        (1, lambda value: value.rstrip()),
        (100, lambda value: value.strip()),
    ):
        for index in range(start, len(lines)):
            if _slice_equals(lines, context, index, normalize):
                return index, fuzz
    return -1, 0


def _slice_equals(
    source: list[str],
    target: list[str],
    start: int,
    normalize: Callable[[str], str],
) -> bool:
    if start + len(target) > len(source):
        return False
    return all(normalize(source[start + offset]) == normalize(expected) for offset, expected in enumerate(target))


def _apply_chunks(source: str, chunks: list[Chunk], newline: str) -> str:
    orig = source.split("\n")
    dest: list[str] = []
    cursor = 0
    for chunk in chunks:
        if chunk.orig_index > len(orig):
            raise ValueError("diff 超出原文长度")
        if cursor > chunk.orig_index:
            raise ValueError("diff 片段重叠")
        dest.extend(orig[cursor : chunk.orig_index])
        dest.extend(chunk.ins_lines)
        cursor = chunk.orig_index + len(chunk.del_lines)
    dest.extend(orig[cursor:])
    return newline.join(dest)
