#!/usr/bin/env bash
set -euo pipefail

result=${1:?}
cd "$(git rev-parse --show-toplevel)"
title="《见天地》新闻"

on_exit() {
  local code=$?
  if [ "$code" -ne 0 ] && [ ! -f .codex-run/summary-written ]; then
    python3 scripts/automation/content_automation.py write-summary \
      --title "$title" \
      --result "$result" \
      --line "刊期核验失败。没有改写 Git 历史。" || true
  fi
}
trap on_exit EXIT

python3 scripts/automation/content_automation.py assert-result jiantiandi-news "$result"
status=$(python3 scripts/automation/content_automation.py print-field "$result" status)
if [ "$status" = "failed" ]; then
  python3 scripts/automation/content_automation.py write-summary \
    --title "$title" \
    --result "$result" \
    --line "模型报告未出刊。"
  exit 1
fi

issue=$(python3 scripts/automation/content_automation.py print-field "$result" issue_date)
if [ "$status" = "published" ]; then
  report=$(node scripts/automation/verify-news-edition.mjs "$issue" --require-minimum)
else
  report=$(node scripts/automation/verify-news-edition.mjs "$issue")
fi

python3 scripts/automation/content_automation.py write-summary \
  --title "$title" \
  --result "$result" \
  --line "核验：" \
  --line "$report" \
  --line "页面：https://www.the-one-and-the-two.com/news/index.html?date=${issue}#front"
