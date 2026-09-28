#!/bin/sh
# Preserve the existing acme.sh TLS-ALPN renewal configuration.
set -eu
DOMAIN="the-one-and-the-two.com"
PROJECT_DIR="/opt/the-one"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
ACME_HOME="/root/.acme.sh"
RENEW_WINDOW_SECONDS=$((30 * 24 * 60 * 60))

if [ -f "${CERT_DIR}/fullchain.pem" ] && openssl x509 -checkend "${RENEW_WINDOW_SECONDS}" -noout -in "${CERT_DIR}/fullchain.pem" >/dev/null 2>&1; then
  exit 0
fi

# Serialize renewal with production cutovers. Never bring back the legacy app.
mkdir -p "${PROJECT_DIR}/deployment"
exec 9>"${PROJECT_DIR}/deployment/release.lock"
flock -w 900 9
restore_nginx() {
  docker start the-one-nginx-1 >/dev/null 2>&1 || true
}
trap restore_nginx EXIT INT TERM

docker stop the-one-nginx-1
ACME_STATUS=0
docker run --rm \
  -p 443:443 \
  -v "${ACME_HOME}:/acme.sh" \
  neilpang/acme.sh --cron --home /acme.sh --server letsencrypt || ACME_STATUS=$?
if [ "${ACME_STATUS}" -ne 0 ] && [ "${ACME_STATUS}" -ne 2 ]; then
  exit "${ACME_STATUS}"
fi
install -m 644 "${ACME_HOME}/${DOMAIN}_ecc/fullchain.cer" "${CERT_DIR}/fullchain.pem"
install -m 600 "${ACME_HOME}/${DOMAIN}_ecc/${DOMAIN}.key" "${CERT_DIR}/privkey.pem"
docker start the-one-nginx-1
docker exec the-one-nginx-1 nginx -s reload >/dev/null 2>&1 || true
trap - EXIT INT TERM
