#!/usr/bin/env bash
# Manually restore the previous healthy container without rebuilding/downloading.
set -Eeuo pipefail
root=/opt/the-one
state=$root/deployment
exec 9>"$state/release.lock"
flock -w 60 9
current=$(cat "$state/current")
previous=$(cat "$state/previous")
[[ -n $current && -n $previous && $current != "$previous" ]]
work="$root/releases/${current#the-one-release-}"
[[ $(docker inspect "$previous" --format '{{.State.Running}}') == true ]]
docker exec "$previous" node -e 'fetch("http://127.0.0.1:3000/",{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
cp "$root/nginx.conf" "$state/rollback-current.conf"
success=0
restore() {
  result=$?
  if [[ $success == 0 ]]; then
    cat "$state/rollback-current.conf" > "$root/nginx.conf"
    docker exec the-one-nginx-1 nginx -t && docker exec the-one-nginx-1 nginx -s reload
  fi
  exit "$result"
}
trap restore EXIT
python3 - "$root/nginx.conf" "$previous" <<'PYCONF'
import pathlib,re,sys
path=pathlib.Path(sys.argv[1])
config,n=re.subn(r'(upstream\s+next_app\s*\{\s*server\s+)[^;]+(;)',lambda m:m[1]+sys.argv[2]+':3000'+m[2],path.read_text(),count=1)
if n!=1: raise SystemExit('Cannot identify live upstream')
# Preserve the inode for the existing file bind mount.
path.write_text(config)
PYCONF
docker exec the-one-nginx-1 nginx -t
docker exec the-one-nginx-1 nginx -s reload
# Allow existing Nginx workers to drain; new connections go to the previous app.
sleep 2
curl --fail --silent --show-error --max-time 15 --resolve www.the-one-and-the-two.com:443:127.0.0.1 https://www.the-one-and-the-two.com/ >/dev/null
target_env="$root/releases/${previous#the-one-release-}/app.env"
[[ -f $target_env ]] || target_env="$work/env.before"
cp "$target_env" "$root/.env.production"
printf '%s\n' "$current" > "$state/previous"
printf '%s\n' "$previous" > "$state/current.new"
mv "$state/current.new" "$state/current"
success=1
echo "Restored previous release: $previous"
