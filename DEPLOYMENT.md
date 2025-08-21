# 🚀 KPI Dashboard 배포 가이드

이 문서는 KPI Dashboard의 Docker 컨테이너화 및 CI/CD 파이프라인 배포 방법을 설명합니다.

## 📋 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [프로덕션 배포](#프로덕션-배포)
3. [CI/CD 파이프라인](#cicd-파이프라인)
4. [모니터링 설정](#모니터링-설정)
5. [트러블슈팅](#트러블슈팅)

## 🛠️ 개발 환경 설정

### 1. 기본 요구사항

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (로컬 개발 시)
- Python 3.11+ (로컬 개발 시)

### 2. 로컬 개발 시작

```bash
# 1. 저장소 클론
git clone <repository-url>
cd kpi-dashboard

# 2. 환경 변수 설정
cp env.example .env
# .env 파일을 편집하여 필요한 값들을 설정

# 3. 개발 환경 시작
docker-compose up -d

# 4. 서비스 확인
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API 문서: http://localhost:8000/docs
```

### 3. 로컬 빌드 테스트

```bash
# 백엔드 이미지 빌드
docker build -t kpi-backend:dev ./kpi_dashboard/backend

# 프론트엔드 이미지 빌드
docker build -t kpi-frontend:dev ./kpi_dashboard/frontend

# 프로덕션 타겟으로 빌드
docker build -t kpi-backend:prod --target production ./kpi_dashboard/backend
docker build -t kpi-frontend:prod --target production ./kpi_dashboard/frontend
```

## 🌟 프로덕션 배포

### 1. 서버 요구사항

**최소 사양:**
- CPU: 2 vCPU
- RAM: 4GB
- 스토리지: 50GB SSD
- OS: Ubuntu 20.04 LTS 이상

**권장 사양:**
- CPU: 4 vCPU
- RAM: 8GB
- 스토리지: 100GB SSD
- 백업 스토리지: 추가 50GB

### 2. 서버 설정

```bash
# 1. Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. 배포 디렉토리 생성
sudo mkdir -p /opt/kpi-dashboard
cd /opt/kpi-dashboard

# 4. 저장소 클론
git clone <repository-url> .

# 5. 환경 변수 설정
cp env.example .env.prod
# .env.prod 파일을 편집하여 프로덕션 값들 설정
```

### 3. 프로덕션 환경 변수 설정

```bash
# .env.prod 파일 편집
cat > .env.prod << EOF
ENVIRONMENT=production
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

# 데이터베이스 설정
DB_USER=kpi_user
DB_PASSWORD=$(openssl rand -base64 32)
DB_NAME=kpi_prod
MONGO_DB_NAME=kpi_prod

# API 키들 (필요한 것만)
ANTHROPIC_API_KEY=your-actual-api-key
PERPLEXITY_API_KEY=your-actual-api-key

# 프로덕션 URL 설정
VITE_API_BASE_URL=https://api.yourdomain.com
FRONTEND_API_URL=https://api.yourdomain.com
BACKEND_BASE_URL=http://backend:8000

# 도메인 설정
DOMAIN=yourdomain.com
API_DOMAIN=api.yourdomain.com
EOF
```

### 4. 프로덕션 배포 실행

```bash
# 1. 프로덕션 환경 시작
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 2. 서비스 확인
docker-compose -f docker-compose.prod.yml ps

# 3. 로그 확인
docker-compose -f docker-compose.prod.yml logs -f

# 4. 헬스체크
curl -f http://localhost/health
```

### 5. SSL 인증서 설정 (Let's Encrypt)

```bash
# 1. Certbot 설치
sudo apt install certbot python3-certbot-nginx

# 2. 인증서 발급
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# 3. 자동 갱신 설정
sudo crontab -e
# 다음 라인 추가:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔄 CI/CD 파이프라인

### 1. GitHub Actions 설정

프로젝트는 이미 `.github/workflows/ci-cd.yml`에 완전한 CI/CD 파이프라인이 구성되어 있습니다.

### 2. Repository Secrets 설정

GitHub 저장소 Settings > Secrets and variables > Actions에서 다음 시크릿들을 설정:

```
# 프로덕션 서버 접속 정보
PROD_HOST=your-production-server-ip
PROD_USER=deploy-user
PROD_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...

# 스테이징 서버 접속 정보 (선택적)
STAGING_HOST=your-staging-server-ip
STAGING_USER=deploy-user
STAGING_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
```

### 3. Repository Variables 설정

GitHub 저장소 Settings > Secrets and variables > Actions > Variables에서:

```
VITE_API_BASE_URL=https://api.yourdomain.com
```

### 4. 배포 플로우

1. **코드 커밋**: `main` 또는 `develop` 브랜치에 푸시
2. **자동 테스트**: Python, Node.js 테스트 실행
3. **보안 스캔**: Trivy를 사용한 취약점 스캔
4. **Docker 빌드**: 멀티 아키텍처 이미지 빌드 및 푸시
5. **자동 배포**: 
   - `main` 브랜치 → 프로덕션 배포
   - `develop` 브랜치 → 스테이징 배포

### 5. 수동 배포

```bash
# 프로덕션 서버에서
cd /opt/kpi-dashboard

# 최신 코드 pull
git pull origin main

# 새 이미지 pull
docker-compose -f docker-compose.prod.yml pull

# 서비스 재시작 (무중단)
docker-compose -f docker-compose.prod.yml up -d --no-deps backend frontend

# 헬스체크
curl -f http://localhost/health
```

## 📊 모니터링 설정

### 1. 모니터링 스택 시작

```bash
# Prometheus + Grafana 시작
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# 접속 확인
# Grafana: http://localhost:3000 (admin / your-grafana-password)
# Prometheus: http://localhost:9090
```

### 2. 모니터링 대상

- **시스템 메트릭**: CPU, 메모리, 디스크, 네트워크
- **애플리케이션 메트릭**: API 응답 시간, 에러율, 요청 수
- **데이터베이스 메트릭**: 연결 수, 쿼리 성능, 스토리지 사용량
- **컨테이너 메트릭**: 리소스 사용량, 재시작 횟수

### 3. 알림 설정

Grafana에서 중요한 메트릭에 대한 알림 규칙 설정:

- API 응답 시간 > 5초
- 에러율 > 5%
- 디스크 사용량 > 85%
- 메모리 사용량 > 90%

## 🔍 트러블슈팅

### 1. 일반적인 문제

**컨테이너가 시작되지 않을 때:**
```bash
# 로그 확인
docker-compose logs -f service-name

# 컨테이너 상태 확인
docker-compose ps

# 리소스 사용량 확인
docker stats
```

**데이터베이스 연결 실패:**
```bash
# PostgreSQL 연결 테스트
docker-compose exec postgres psql -U postgres -d netperf -c "SELECT 1;"

# MongoDB 연결 테스트
docker-compose exec mongo mongosh --eval "db.adminCommand('ping')"
```

**API 응답이 느릴 때:**
```bash
# 백엔드 로그 확인
docker-compose logs -f backend

# 성능 메트릭 확인
curl http://localhost:8000/api/performance
```

### 2. 로그 수집 및 분석

```bash
# 모든 서비스 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend

# 에러 로그만 필터링
docker-compose logs backend 2>&1 | grep ERROR

# 로그 파일 위치
# Backend: /app/logs/
# Frontend: /var/log/nginx/
# MongoDB: Docker 로그
# PostgreSQL: Docker 로그
```

### 3. 백업 및 복구

**데이터베이스 백업:**
```bash
# PostgreSQL 백업
docker-compose exec postgres pg_dump -U postgres netperf > backup_$(date +%Y%m%d).sql

# MongoDB 백업
docker-compose exec mongo mongodump --db kpi --out /tmp/backup
docker cp container_name:/tmp/backup ./mongodb_backup_$(date +%Y%m%d)
```

**복구:**
```bash
# PostgreSQL 복구
docker-compose exec -T postgres psql -U postgres netperf < backup_20240115.sql

# MongoDB 복구
docker cp ./mongodb_backup_20240115 container_name:/tmp/restore
docker-compose exec mongo mongorestore --db kpi /tmp/restore/kpi
```

### 4. 성능 최적화

**리소스 제한 조정:**
```yaml
# docker-compose.prod.yml에서
deploy:
  resources:
    limits:
      memory: 4G  # 메모리 증가
      cpus: '2.0'  # CPU 증가
```

**캐시 최적화:**
```bash
# Redis 추가 (선택적)
docker run -d --name redis --network kpi-network redis:7-alpine
```

## 📞 지원 및 문의

배포 관련 문제가 발생하면:

1. 먼저 이 가이드의 트러블슈팅 섹션을 확인
2. GitHub Issues에 문제 보고
3. 로그 파일과 함께 상세한 오류 정보 제공

---

*이 배포 가이드는 지속적으로 업데이트됩니다. 최신 버전은 GitHub 저장소에서 확인하세요.*
