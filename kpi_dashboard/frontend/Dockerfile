# === 의존성 설치 ===
FROM node:20-alpine AS deps
WORKDIR /app

# 보안 및 성능을 위한 패키지 관리자 설정
RUN npm config set fund false && \
    npm config set audit-level high

# npm 우선 사용 (package-lock.json 존재 시)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --only=production; \
    else npm i --only=production; fi

# === 빌드 스테이지 ===
FROM node:20-alpine AS build
WORKDIR /app

# 빌드 도구 설치
RUN apk add --no-cache git

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 환경변수로 API 엔드포인트 주입 가능 (VITE_*)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# 빌드 실행
RUN if [ -f pnpm-lock.yaml ]; then \
        npm i -g pnpm && pnpm run build; \
    else \
        npm run build; \
    fi

# === 개발용 런타임 ===
FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=build /app/dist .
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 5173 80
ENTRYPOINT ["/docker-entrypoint.sh"]

# === 프로덕션 런타임 ===
FROM nginx:1.27-alpine AS production

# 보안 강화를 위한 비루트 사용자
RUN addgroup -g 1001 -S nginx && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# 프로덕션용 nginx 설정
COPY nginx/nginx.prod.conf /etc/nginx/nginx.conf
COPY nginx/sites-available/default.prod.conf /etc/nginx/conf.d/default.conf

# 정적 파일 복사
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=build /app/dist .

# 권한 설정
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# 프로덕션용 헬스체크 엔드포인트 추가
RUN echo '<!DOCTYPE html><html><head><title>Health Check</title></head><body><h1>OK</h1></body></html>' > /usr/share/nginx/html/health.html

# 비루트 사용자로 실행
USER nginx

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


