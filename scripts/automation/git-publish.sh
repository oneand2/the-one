#!/usr/bin/env bash
# Shared git helpers for the content publish jobs. Source this file; do not execute it.
: "${RUNNER_TEMP:=${TMPDIR:-/tmp}}"

sync_to_origin_main() {
  git fetch origin main
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "将工作区对齐到 origin/main（$(git rev-parse --short origin/main)）。"
    git checkout --detach origin/main
  fi
}

apply_content_patch() {
  local patch=$1
  # shellcheck disable=SC2034
  apply_state=empty
  if [ ! -s "$patch" ]; then
    return 0
  fi
  if git apply --check "$patch"; then
    git apply --index "$patch"
    # shellcheck disable=SC2034
    apply_state=applied
    return 0
  fi
  if git apply --reverse --check "$patch"; then
    # shellcheck disable=SC2034
    apply_state=present
    echo "这些内容已经在当前 main 上。"
    return 0
  fi
  echo "补丁无法应用到当前 main，已停止，未 force-push。" >&2
  return 1
}

commit_cached_changes() {
  local task=$1
  local result=$2
  if git diff --cached --quiet; then
    echo "没有可提交的变更。" >&2
    return 1
  fi
  local today
  today=$(TZ=Asia/Shanghai date +%F)
  python3 scripts/automation/content_automation.py format-commit "$task" "$result" "$today" > "$RUNNER_TEMP/commit-message.txt"
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git commit -F "$RUNNER_TEMP/commit-message.txt"
}

push_main() {
  git fetch origin main
  local parent remote
  parent=$(git rev-parse HEAD^)
  remote=$(git rev-parse origin/main)
  if [ "$parent" != "$remote" ]; then
    echo "origin/main 与本次提交的父提交不一致，已停止，未 force-push。" >&2
    return 1
  fi
  if ! git push origin HEAD:main; then
    echo "推送 origin/main 失败，未 force-push。" >&2
    return 1
  fi
  git fetch origin main
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "推送后远端 main 与本地提交不一致。" >&2
    return 1
  fi
}
