#!/usr/bin/env bash
set -euo pipefail

patch=${1:?}
result=${2:?}
cd "$(git rev-parse --show-toplevel)"
title="每日续写见众生"

on_exit() {
  local code=$?
  if [ "$code" -ne 0 ] && [ ! -f .codex-run/summary-written ]; then
    python3 scripts/automation/content_automation.py write-summary \
      --title "$title" \
      --result "$result" \
      --line "发布步骤失败。未使用 force-push。" || true
  fi
}
trap on_exit EXIT

python3 scripts/automation/content_automation.py assert-result jianzhongsheng "$result"
status=$(python3 scripts/automation/content_automation.py print-field "$result" status)
if [ "$status" = "failed" ]; then
  python3 scripts/automation/content_automation.py write-summary \
    --title "$title" \
    --result "$result" \
    --line "模型报告失败。未推送 main，未触发部署。"
  exit 1
fi

script_dir=$(cd "$(dirname "$0")" && pwd)
# shellcheck source-path=SCRIPTDIR
# shellcheck source=git-publish.sh
source "$script_dir/git-publish.sh"
sync_to_origin_main

before=$(mktemp)
cp src/content/jianzhongsheng.ts "$before"
apply_state=empty
apply_content_patch "$patch"

if [ "$apply_state" = "applied" ]; then
  python3 scripts/automation/content_automation.py assert-cached-paths jianzhongsheng "$result"
  node scripts/automation/jianzhongsheng-growth.mjs "$before" src/content/jianzhongsheng.ts
  git diff --cached --check
  npx eslint src/content/jianzhongsheng.ts
  npx tsc --noEmit
  npm run ui:check
  npm run jianzhongsheng:check
  commit_cached_changes jianzhongsheng "$result"
  push_main
elif [ "$apply_state" != "present" ]; then
  echo "没有可发布的见众生变更。" >&2
  exit 1
fi

bash scripts/automation/wait-for-deploy.sh
sha=$(git rev-parse --short HEAD)
deploy_url=$(cat "${RUNNER_TEMP:-/tmp}/deploy-run-url.txt" 2>/dev/null || true)
python3 scripts/automation/content_automation.py write-summary \
  --title "$title" \
  --result "$result" \
  --line "提交：$(git rev-parse HEAD)" \
  --line "短提交：${sha}" \
  --line "部署：${deploy_url:-线上已包含这次提交}" \
  --line "页面：https://www.the-one-and-the-two.com/?tab=wendao"
