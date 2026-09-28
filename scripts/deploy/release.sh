#!/usr/bin/env bash
# Runs as root on ECS. Candidate validation never changes the live upstream.
set -Eeuo pipefail
release=${1:?release SHA required}
[[ $release =~ ^[0-9a-f]{40}$ ]] || exit 2
root=/opt/the-one
incoming=$root/incoming/$release
releases=$root/releases
work=$releases/$release
state=$root/deployment
mkdir -p "$work" "$state"
chmod 700 "$work" "$state"
exec 9>"$state/release.lock"
flock -w 900 9
image="the-one-app:$release"
candidate="the-one-release-$release"
nginx=the-one-nginx-1
network=the-one_default
started=$(date +%s)
old=$(cat "$state/current" 2>/dev/null || printf 'the-one-app-1')
older=$(cat "$state/previous" 2>/dev/null || true)
if [[ $old == "$candidate" ]]; then
  echo "Release already active: $release"
  exit 0
fi
docker inspect "$old" >/dev/null
docker inspect "$nginx" >/dev/null
cp "$root/nginx.conf" "$work/nginx.before.conf"
cp "$root/.env.production" "$work/env.before"
chmod 600 "$work/env.before"
switched=0
committed=0
rollback() {
  result=$?
  trap - EXIT INT TERM
  if [[ $committed == 0 ]]; then
    if [[ $switched == 1 ]]; then
      cat "$work/nginx.before.conf" > "$root/nginx.conf"
      if ! { docker exec "$nginx" nginx -t && docker exec "$nginx" nginx -s reload; }; then
        echo 'Nginx rollback needs attention; both application containers retained.' >&2
        exit 1
      fi
      cp "$work/env.before" "$root/.env.production"
      echo 'Restored previous Nginx upstream.'
    fi
    docker rm -f "$candidate" >/dev/null 2>&1 || true
    echo "Release failed; previous application retained: $old" >&2
  fi
  rm -f "$incoming/payment-production.env"
  exit "$result"
}
trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 "$incoming/image-archive.py" unpack "$incoming/manifest.json" "$root/image-blobs" | docker load
# A successful import alone is not proof that the requested release was loaded.
[[ $(docker image inspect "$image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}') == "$release" ]]
cp "$root/.env.production" "$work/app.env"
python3 - "$work/app.env" "$incoming/payment-production.env" <<'PY'
import pathlib,sys
base, updates = map(pathlib.Path,sys.argv[1:])
new = updates.read_text().splitlines()
keys = {line.split('=',1)[0] for line in new if '=' in line}
old = [line for line in base.read_text().splitlines() if line.split('=',1)[0] not in keys]
base.write_text('\n'.join(old+new)+'\n')
PY
chmod 600 "$work/app.env"
docker rm -f "$candidate" >/dev/null 2>&1 || true
docker run -d --name "$candidate" --network "$network" \
  --restart unless-stopped --env-file "$work/app.env" \
  -e NODE_ENV=production -e PORT=3000 -e HOSTNAME=0.0.0.0 -e RELEASE_SHA="$release" \
  --label com.the-one.release="$release" "$image"
# Retain previous hashed browser assets so already-open pages survive cutover.
# Store only each release's own assets, avoiding unbounded accumulation.
mkdir -p "$work/static" "$work/previous-static"
docker cp "$candidate:/app/.next/static/." "$work/static/"
previous_assets="$releases/${old#the-one-release-}/static"
if [[ -d $previous_assets ]]; then
  docker cp "$previous_assets/." "$candidate:/app/.next/static/"
else
  docker cp "$old:/app/.next/static/." "$work/previous-static/"
  docker cp "$work/previous-static/." "$candidate:/app/.next/static/"
fi
healthy=0
for attempt in $(seq 1 30); do
  if docker exec "$candidate" node -e '
    const release=process.env.RELEASE_SHA;
    Promise.all([fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(3000)}).then(async r=>r.ok&&(await r.json()).release===release),fetch("http://127.0.0.1:3000/",{signal:AbortSignal.timeout(3000)}).then(r=>r.ok),fetch("http://127.0.0.1:3000/api/admin/ambassadors",{signal:AbortSignal.timeout(3000)}).then(r=>r.status===403)]).then(ok=>process.exit(ok.every(Boolean)?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then healthy=1; break; fi
  sleep 2
done
[[ $healthy == 1 ]] || { echo 'Candidate health checks failed' >&2; exit 1; }
# Preserve the entire existing HTTPS/server configuration; replace only upstream.
python3 - "$root/nginx.conf" "$work/nginx.conf" "$candidate" <<'PY'
import pathlib,re,sys
source,target,container=sys.argv[1:]
config=pathlib.Path(source).read_text()
pattern=r'(upstream\s+next_app\s*\{\s*server\s+)[^;]+(;)' 
result,n=re.subn(pattern,lambda m:m[1]+container+':3000'+m[2],config,count=1)
if n!=1: raise SystemExit('Cannot identify existing application upstream')
pathlib.Path(target).write_text(result)
PY
nginx_image=$(docker inspect "$nginx" --format '{{.Config.Image}}')
docker run --rm --network "$network" \
  -v "$work/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v /etc/letsencrypt:/etc/letsencrypt:ro -v /var/www/certbot:/var/www/certbot:ro \
  "$nginx_image" nginx -t
# The existing nginx.conf is a FILE bind mount: write in place, never rename it.
switched=1
cat "$work/nginx.conf" > "$root/nginx.conf"
docker exec "$nginx" nginx -t
docker exec "$nginx" nginx -s reload
for attempt in $(seq 1 20); do
  actual=$(curl --fail --silent --show-error --max-time 10 \
    --resolve www.the-one-and-the-two.com:443:127.0.0.1 \
    https://www.the-one-and-the-two.com/api/health | python3 -c 'import json,sys; print(json.load(sys.stdin).get("release",""))' 2>/dev/null || true)
  [[ $actual == "$release" ]] && break
  sleep 2
done
[[ $actual == "$release" ]] || { echo 'HTTPS cutover verification failed' >&2; exit 1; }
curl --fail --silent --show-error --max-time 15 --resolve www.the-one-and-the-two.com:443:127.0.0.1 https://www.the-one-and-the-two.com/ >/dev/null
cp "$incoming/manifest.json" "$work/manifest.json"
cp "$incoming/rollback.sh" "$state/rollback.sh"
cp "$incoming/cleanup.py" "$state/cleanup.py"
cp "$work/app.env" "$root/.env.production"
chmod 600 "$root/.env.production"
printf '%s\n' "$old" > "$work/previous"
printf '%s\n' "$old" > "$state/previous"
printf '%s\n' "$candidate" > "$state/current.new"
mv "$state/current.new" "$state/current"
committed=1
# Keep the immediate previous container running for instant rollback and drains.
# Only retire a version that is neither current nor its rollback target.
if [[ -n $older && $older != "$old" && $older != "$candidate" ]]; then docker rm -f "$older" >/dev/null 2>&1 || true; fi
bytes=$(docker image inspect "$image" --format '{{.Size}}')
printf '{"release":"%s","image_bytes":%s,"server_deploy_seconds":%s,"previous":"%s"}\n' "$release" "$bytes" "$(( $(date +%s) - started ))" "$old" | tee "$work/result.json"
# Cleanup is limited to this application's managed releases; live/previous are protected.
python3 "$state/cleanup.py" || echo 'Cache cleanup deferred; release remains healthy.' >&2
