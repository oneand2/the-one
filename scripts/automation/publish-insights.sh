#!/usr/bin/env bash
set -euo pipefail

patch=${1:?}
result=${2:?}
cd "$(git rev-parse --show-toplevel)"
title="今日见闻"

on_exit() {
  local code=$?
  if [ "$code" -ne 0 ] && [ ! -f .codex-run/summary-written ]; then
    python3 scripts/automation/content_automation.py write-summary \
      --title "$title" \
      --result "$result" \
      --line "发布步骤失败。未使用 force-push；未在部署未完成时写入数据库。" || true
  fi
}
trap on_exit EXIT

python3 scripts/automation/content_automation.py assert-result jinri-jianwen "$result"
status=$(python3 scripts/automation/content_automation.py print-field "$result" status)
if [ "$status" = "failed" ]; then
  python3 scripts/automation/content_automation.py write-summary \
    --title "$title" \
    --result "$result" \
    --line "模型报告失败。未推送 main，未写入 daily_insights。"
  exit 1
fi
if [ "$status" = "already_live" ] && [ -s "$patch" ]; then
  echo "已在线路径不应再改文件。" >&2
  exit 1
fi

script_dir=$(cd "$(dirname "$0")" && pwd)
# shellcheck source-path=SCRIPTDIR
# shellcheck source=git-publish.sh
source "$script_dir/git-publish.sh"
sync_to_origin_main
apply_state=empty
apply_content_patch "$patch"
if [ "$apply_state" = "applied" ]; then
  python3 scripts/automation/content_automation.py assert-cached-paths jinri-jianwen "$result"
fi

week_output=$(python3 scripts/automation/content_automation.py print-week "$result")
week=$(printf '%s\n' "$week_output" | sed -n '1p')
today=$(printf '%s\n' "$week_output" | sed -n '2p')
npm run insights:publish -- --file "$week" --dry-run

pushed=0
if [ "$apply_state" = "applied" ]; then
  git diff --cached --check
  commit_cached_changes jinri-jianwen "$result"
  push_main
  pushed=1
fi

svg_code() {
  curl --silent --output /dev/null --write-out '%{http_code}' --max-time 30 \
    "https://www.the-one-and-the-two.com/daily-insights/${today}.svg" || true
}

svg_status=$(svg_code)
if [ "$svg_status" != "200" ]; then
  bash scripts/automation/wait-for-deploy.sh
  svg_status=$(svg_code)
fi
if [ "$svg_status" != "200" ]; then
  echo "生产插画仍不可访问（HTTP ${svg_status}）。未写入数据库。" >&2
  exit 1
fi

set +e
info=$(npx tsx scripts/automation/verify-daily-insight.ts "$week" "$today")
verify_code=$?
set -e
note="数据库已有今天这一则，未重复写入。"
if [ "$verify_code" -eq 4 ]; then
  npm run insights:publish -- --file "$week"
  info=$(npx tsx scripts/automation/verify-daily-insight.ts "$week" "$today")
  note="已写入 daily_insights，并回读确认今天恰有一条。"
elif [ "$verify_code" -ne 0 ]; then
  echo "今日见闻回读未通过。" >&2
  exit 1
fi

sha=$(git rev-parse HEAD)
deploy_url=$(cat "${RUNNER_TEMP:-/tmp}/deploy-run-url.txt" 2>/dev/null || true)
if [ "$pushed" -eq 1 ]; then
  push_note="已把周稿和插画推送到 main。"
else
  push_note="没有新的内容提交。"
fi
python3 scripts/automation/content_automation.py write-summary \
  --title "$title" \
  --result "$result" \
  --line "日期：${today}" \
  --line "回读：${info}" \
  --line "${note}" \
  --line "周稿：${week}" \
  --line "提交：${sha}" \
  --line "${push_note}" \
  --line "部署：${deploy_url:-线上已包含仓库中的插画}" \
  --line "插画：https://www.the-one-and-the-two.com/daily-insights/${today}.svg"
