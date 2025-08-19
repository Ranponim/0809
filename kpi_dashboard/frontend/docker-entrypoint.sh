#!/bin/sh
set -e

# Nginx 런타임 환경변수 주입을 위해 기본값 안내 로그
echo "[entrypoint] BACKEND_BASE_URL=${BACKEND_BASE_URL:-unset} VITE_API_BASE_URL=${VITE_API_BASE_URL:-unset}"

# runtime-config.js 생성 (정적 파일로 제공)
cat <<EOF > /usr/share/nginx/html/runtime-config.js
window.__RUNTIME_CONFIG__ = {
  BACKEND_BASE_URL: "${BACKEND_BASE_URL:-}",
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}"
};
EOF

exec nginx -g 'daemon off;'


