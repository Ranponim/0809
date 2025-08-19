FROM node:20-alpine AS deps
WORKDIR /app
# npm 우선 사용 (package-lock.json 존재 시)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    else npm i; fi

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 환경변수로 API 엔드포인트 주입 가능 (VITE_*)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN if [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm run build; else npm run build; fi

# 정적 파일 서빙: nginx
FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=build /app/dist .
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 5173 80
ENTRYPOINT ["/docker-entrypoint.sh"]


