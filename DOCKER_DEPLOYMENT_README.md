# 🚀 Analysis LLM Docker 배포 가이드

## 📋 개요

이 가이드는 모듈화된 Analysis LLM 시스템을 Docker 컨테이너로 배포하는 방법을 설명합니다. 기존의 단일 파일 방식에서 벗어나 마이크로서비스 아키텍처로 구성된 시스템을 컨테이너화하여 배포합니다.

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Open WebUI    │ -> │   MCPO          │ -> │  MCP Server     │
│   (Frontend)    │    │  (MCP Client)   │    │  (Analysis LLM) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (Database)    │
                    └─────────────────┘
```

### 컨테이너 구성
- **analysis-llm-mcp**: 메인 MCP 서버 (Analysis LLM)
- **postgres**: PostgreSQL 데이터베이스
- **mcpo**: 기존 MCPO 컨테이너 (수정됨)
- **redis**: 캐싱 서버 (선택사항)
- **grafana**: 모니터링 대시보드 (선택사항)
- **prometheus**: 메트릭스 수집 (선택사항)

## 📦 빠른 시작

### 1. 환경 설정

```bash
# 환경 파일 복사 및 설정
cp docker-env.example .env

# .env 파일 편집 (API 키 등 설정)
nano .env
```

### 2. 배포 스크립트 실행

```bash
# 실행 권한 부여
chmod +x deploy.sh

# 전체 배포 (빌드 + 실행)
./deploy.sh

# 또는 개별 단계로 실행
./deploy.sh -b    # 이미지 빌드
./deploy.sh -d    # 서비스 배포
```

### 3. 서비스 확인

```bash
# 서비스 상태 확인
./deploy.sh --status

# 로그 확인
./deploy.sh -l
```

## 🔧 수동 배포 방법

### Docker 이미지 빌드

```bash
# MCP 서버 이미지 빌드
docker build -f Dockerfile.mcp -t analysis-llm-mcp:latest .

# 또는 Docker Compose로 빌드
docker-compose -f docker-compose.mcp.yml build
```

### 서비스 시작

```bash
# Docker Compose로 서비스 시작
docker-compose -f docker-compose.mcp.yml --env-file .env up -d

# 또는 최신 Docker Compose 명령어
docker compose -f docker-compose.mcp.yml --env-file .env up -d
```

### 서비스 중지

```bash
# 서비스 중지
docker-compose -f docker-compose.mcp.yml down

# 볼륨까지 삭제 (데이터 초기화)
docker-compose -f docker-compose.mcp.yml down -v
```

## ⚙️ 환경 설정

### 필수 환경 변수

```bash
# API Keys (필수)
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key

# 데이터베이스 (필수)
POSTGRES_DB=kpi_db
POSTGRES_USER=kpi_user
POSTGRES_PASSWORD=your_password

# LLM 설정 (필수)
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.0-flash-exp
```

### 선택 환경 변수

```bash
# 로깅
LOG_LEVEL=INFO
LOG_FORMAT=json

# 모니터링
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30

# 캐싱
REDIS_HOST=redis
REDIS_PORT=6379
```

## 🌐 네트워크 구성

### 내부 네트워크
- **analysis-network**: 모든 서비스가 연결되는 Docker 네트워크
- **서브넷**: 172.20.0.0/16

### 포트 매핑
- **PostgreSQL**: 5432 (호스트에서 접근 가능)
- **MCPO**: 3000 (기존 포트 유지)
- **Grafana**: 3001 (모니터링용)
- **Prometheus**: 9090 (메트릭스용)

## 📊 모니터링

### Grafana 대시보드
```bash
# 브라우저에서 접근
http://localhost:3001

# 기본 계정
Username: admin
Password: admin
```

### Prometheus 메트릭스
```bash
# 메트릭스 엔드포인트
http://localhost:9090
```

## 🔄 백업 및 복원

### 데이터베이스 백업
```bash
# 자동 백업
./deploy.sh --backup

# 수동 백업
docker exec analysis-postgres pg_dump -U kpi_user -d kpi_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 데이터베이스 복원
```bash
# 자동 복원
./deploy.sh --restore backup_file.sql

# 수동 복원
docker exec -i analysis-postgres psql -U kpi_user -d kpi_db < backup_file.sql
```

## 🐛 문제 해결

### 일반적인 문제들

#### 1. 모듈을 찾을 수 없음
```bash
# Python 경로 확인
docker exec -it analysis-llm-mcp python -c "import sys; print(sys.path)"

# 컨테이너 재빌드
./deploy.sh -b --no-cache
```

#### 2. 데이터베이스 연결 실패
```bash
# 데이터베이스 로그 확인
docker logs analysis-postgres

# 연결 테스트
docker exec -it analysis-postgres psql -U kpi_user -d kpi_db -c "SELECT 1;"
```

#### 3. MCP 서버 연결 실패
```bash
# MCP 서버 로그 확인
docker logs analysis-llm-mcp

# 헬스 체크
docker exec analysis-llm-mcp python -c "from analysis_llm.service import get_service; import asyncio; asyncio.run(get_service().health_check())"
```

### 디버깅 명령어들

```bash
# 컨테이너 진입
docker exec -it analysis-llm-mcp /bin/bash

# 로그 실시간 모니터링
docker-compose -f docker-compose.mcp.yml logs -f analysis-llm-mcp

# 리소스 사용량 확인
docker stats

# 네트워크 연결 확인
docker network inspect analysis-network
```

## 🔒 보안 고려사항

### 1. 환경 변수 관리
- API 키는 `.env` 파일에서 관리
- 프로덕션에서는 Docker Secrets 또는 외부 키 관리 시스템 사용

### 2. 네트워크 보안
- 내부 서비스는 analysis-network로 격리
- 외부 포트는 필요한 경우에만 노출

### 3. 사용자 권한
- 컨테이너는 비루트 사용자로 실행
- 최소 권한 원칙 적용

## 📈 성능 최적화

### 리소스 제한
```yaml
# docker-compose.mcp.yml에서 조정
services:
  analysis-llm-mcp:
    deploy:
      resources:
        limits:
          memory: 2g
          cpus: '1.0'
        reservations:
          memory: 512m
          cpus: '0.5'
```

### 캐싱 활성화
```bash
# Redis 캐시 활성화
docker-compose -f docker-compose.mcp.yml --profile cache up -d
```

## 🚀 프로덕션 배포

### 1. 이미지 태그 관리
```bash
# 버전 태그 생성
docker tag analysis-llm-mcp:latest analysis-llm-mcp:v2.0.0

# 레지스트리에 푸시
docker push your-registry.com/analysis-llm-mcp:v2.0.0
```

### 2. 스케일링
```bash
# MCP 서버 스케일링
docker-compose -f docker-compose.mcp.yml up -d --scale analysis-llm-mcp=3

# 로드 밸런서 설정 필요
```

### 3. 고가용성
```bash
# 여러 호스트에 배포
# Docker Swarm 또는 Kubernetes 사용 고려
```

## 📋 배포 체크리스트

### 사전 준비
- [ ] `.env` 파일 생성 및 설정
- [ ] Docker 및 Docker Compose 설치 확인
- [ ] 필요한 API 키 준비
- [ ] 네트워크 포트 사용 가능 확인

### 배포 단계
- [ ] 환경 파일 검증
- [ ] Docker 이미지 빌드
- [ ] 서비스 시작
- [ ] 헬스 체크 확인
- [ ] 로그 및 모니터링 확인

### 운영 준비
- [ ] 백업 설정 확인
- [ ] 모니터링 대시보드 설정
- [ ] 로그 로테이션 설정
- [ ] 알림 설정

## 📞 지원

문제가 발생하거나 도움이 필요한 경우:

1. 로그 확인: `./deploy.sh -l`
2. 상태 확인: `./deploy.sh --status`
3. 헬프: `./deploy.sh --help`

## 🔄 기존 시스템 마이그레이션

### 현재 방식에서 새로운 방식으로 마이그레이션

```bash
# 1. 기존 MCPO 컨테이너 중지
docker stop your-existing-mcpo

# 2. 새로운 시스템 배포
./deploy.sh

# 3. 데이터 마이그레이션 (필요한 경우)
# PostgreSQL 데이터 이전
pg_dump old_db | psql new_db

# 4. 설정 업데이트
# 기존 MCPO 설정을 새로운 MCP 설정으로 업데이트
```

이 가이드를 따라하면 기존의 단일 파일 방식에서 벗어나 확장 가능하고 유지보수하기 쉬운 마이크로서비스 아키텍처로 성공적으로 마이그레이션할 수 있습니다.





