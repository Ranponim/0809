#!/bin/sh
set -e

# Nginx 런타임 환경변수 주입을 위해 기본값 안내 로그
echo "[entrypoint] BACKEND_BASE_URL=${BACKEND_BASE_URL:-unset} VITE_API_BASE_URL=${VITE_API_BASE_URL:-unset} \n[entrypoint] DB_HOST=${DB_HOST:-unset} DB_PORT=${DB_PORT:-unset} DB_USER=${DB_USER:-unset} DB_NAME=${DB_NAME:-unset}"

# runtime-config.js 생성 (정적 파일로 제공)
cat <<EOF > /usr/share/nginx/html/runtime-config.js
window.__RUNTIME_CONFIG__ = {
  BACKEND_BASE_URL: "${BACKEND_BASE_URL:-}",
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  DB_HOST: "${DB_HOST:-}",
  DB_PORT: "${DB_PORT:-}",
  DB_USER: "${DB_USER:-}",
  DB_PASSWORD: "${DB_PASSWORD:-}",
  DB_NAME: "${DB_NAME:-}"
};
EOF

exec nginx -g 'daemon off;'


