#!/usr/bin/env bash
# Dispatch Deploy to Aliyun if the current HEAD is not yet the live release, then wait.
# GITHUB_TOKEN push events do not start that workflow; workflow_dispatch does.
set -euo pipefail

SHA=$(git rev-parse HEAD)
: "${GITHUB_REPOSITORY:?}"
: "${GH_TOKEN:?}"
export GH_REPO="$GITHUB_REPOSITORY"

if ! [[ "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "当前提交编号无效。" >&2
  exit 1
fi

deadline=$((SECONDS + ${DEPLOY_WAIT_SECONDS:-2400}))
pending=0
saw_success_for=""
dispatched_tip=""
runtime_dir=${RUNNER_TEMP:-/tmp}
url_file="$runtime_dir/deploy-run-url.txt"
mkdir -p "$runtime_dir"

health_sha() {
  local body
  body=$(curl --silent --show-error --max-time 20 https://www.the-one-and-the-two.com/api/health || true)
  printf '%s' "$body" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("release") or "")
except Exception:
    print("")'
}

contains() {
  local ancestor=$1
  local descendant=$2
  [[ "$descendant" =~ ^[0-9a-f]{40}$ ]] || return 1
  git cat-file -e "${descendant}^{commit}" 2>/dev/null || git fetch --no-tags origin "$descendant" >/dev/null 2>&1 || return 1
  git merge-base --is-ancestor "$ancestor" "$descendant"
}

while [ "$SECONDS" -lt "$deadline" ]; do
  git fetch origin main
  tip=$(git rev-parse origin/main)
  if ! [[ "$tip" =~ ^[0-9a-f]{40}$ ]]; then
    echo "origin/main 的提交编号无效。" >&2
    exit 1
  fi
  tip_contains=false
  if contains "$SHA" "$tip"; then tip_contains=true; fi
  live=$(health_sha)
  live_contains=false
  if contains "$SHA" "$live"; then live_contains=true; fi
  gh run list --workflow deploy-aliyun.yml --branch main --limit 20 \
    --json databaseId,headSha,status,conclusion,url,createdAt > "$runtime_dir/runs.json"
  action=$(
    DEPLOY_TIP="$tip" \
    DEPLOY_SHA="$SHA" \
    DEPLOY_TIP_CONTAINS="$tip_contains" \
    DEPLOY_LIVE_CONTAINS="$live_contains" \
    DEPLOY_DISPATCHED_TIP="$dispatched_tip" \
    DEPLOY_SAW_SUCCESS="$saw_success_for" \
    DEPLOY_RUNS_FILE="$runtime_dir/runs.json" \
    python3 -c 'import json, os, sys
from pathlib import Path
sys.path.insert(0, "scripts/automation")
from content_automation import select_deploy
state = {
    "tip": os.environ["DEPLOY_TIP"],
    "sha": os.environ["DEPLOY_SHA"],
    "tip_contains_sha": os.environ["DEPLOY_TIP_CONTAINS"] == "true",
    "live_contains": os.environ["DEPLOY_LIVE_CONTAINS"] == "true",
    "dispatched_tip": os.environ["DEPLOY_DISPATCHED_TIP"],
    "saw_success_for": os.environ["DEPLOY_SAW_SUCCESS"],
    "runs": json.loads(Path(os.environ["DEPLOY_RUNS_FILE"]).read_text() or "[]"),
}
print(select_deploy(state))'
  )
  case "$action" in
    success)
      if [ -n "$live" ]; then printf '%s\n' "$live" > "$runtime_dir/deploy-live-sha.txt"; fi
      echo "生产版本已包含 $SHA"
      exit 0
      ;;
    dispatch)
      gh workflow run deploy-aliyun.yml --ref main
      dispatched_tip=$tip
      saw_success_for=""
      pending=0
      echo "已触发 Deploy to Aliyun（main）。"
      sleep 15
      ;;
    pending)
      pending=$((pending + 1))
      if [ "$pending" -ge 12 ]; then
        echo "已触发 Deploy to Aliyun，但没有看到对应的运行。" >&2
        exit 1
      fi
      sleep 15
      ;;
    wait-health\ *)
      printf '%s\n' "$action" | awk '{print $3}' > "$url_file"
      saw_success_for=$tip
      sleep 20
      ;;
    watch\ *)
      run_id=$(printf '%s\n' "$action" | awk '{print $2}')
      run_url=$(printf '%s\n' "$action" | awk '{print $3}')
      printf '%s\n' "$run_url" > "$url_file"
      echo "等待 Deploy to Aliyun 运行 $run_id"
      gh run watch "$run_id" --exit-status || true
      ;;
    fail\ *)
      printf '%s\n' "${action#fail }" >&2
      exit 1
      ;;
    *)
      echo "无法识别的部署动作。" >&2
      exit 1
      ;;
  esac
done

echo "等待 Deploy to Aliyun 超时。" >&2
exit 1
