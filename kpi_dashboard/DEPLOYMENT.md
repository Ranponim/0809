# KPI Dashboard 배포 가이드

## 시스템 개요

KPI Dashboard는 3GPP KPI 데이터를 분석하고 시각화하는 웹 애플리케이션입니다.

### 아키텍처
- **Frontend**: React + Vite (포트 5173)
- **Backend**: FastAPI + Celery + Redis (포트 8000)
- **Database**: PostgreSQL + MongoDB
- **ML Models**: PyTorch (LSTM Autoencoder, Transformer)
- **Task Queue**: Celery + Redis

## 배포 전 체크리스트

### 1. 시스템 요구사항

#### 하드웨어 요구사항
- **CPU**: 최소 4코어, 권장 8코어 이상
- **RAM**: 최소 8GB, 권장 16GB 이상
- **GPU**: NVIDIA GPU (A6000 이상 권장) - ML 모델 가속용
- **Storage**: 최소 50GB 여유 공간

#### 소프트웨어 요구사항
- **OS**: Linux (Ubuntu 20.04+), Windows 10+, macOS 12+
- **Python**: 3.11+
- **Node.js**: 18+
- **Docker**: 20.10+ (선택사항)
- **CUDA**: 11.8+ (GPU 사용 시)

### 2. 환경 설정

#### Python 환경 설정
```bash
# Python 가상환경 생성
python -m venv venv
source venv/bin/activate  # Linux/macOS
# 또는
venv\Scripts\activate     # Windows

# 의존성 설치
pip install -r requirements.txt
```

#### Node.js 환경 설정
```bash
# 프론트엔드 의존성 설치
cd frontend
npm install
```

#### 환경 변수 설정
```bash
# .env 파일 생성
cp .env.example .env

# 필수 환경 변수 설정
DATABASE_URL=postgresql://user:password@localhost:5432/kpi_dashboard
MONGODB_URL=mongodb://localhost:27017/kpi_dashboard
REDIS_URL=redis://localhost:6379/0

# AI 모델 API 키 (선택사항)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
PERPLEXITY_API_KEY=your_perplexity_key
```

### 3. 데이터베이스 설정

#### PostgreSQL 설정
```bash
# PostgreSQL 설치 (Ubuntu)
sudo apt update
sudo apt install postgresql postgresql-contrib

# 데이터베이스 생성
sudo -u postgres createdb kpi_dashboard
sudo -u postgres createuser kpi_user
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE kpi_dashboard TO kpi_user;"
```

#### MongoDB 설정
```bash
# MongoDB 설치 (Ubuntu)
sudo apt install mongodb

# MongoDB 시작
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

#### Redis 설정
```bash
# Redis 설치 (Ubuntu)
sudo apt install redis-server

# Redis 시작
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### 4. ML 모델 설정

#### PyTorch 설치 (GPU 지원)
```bash
# CUDA 지원 PyTorch 설치
pip install torch==2.7.1 torchvision==0.22.1 torchaudio==2.7.1 --index-url https://download.pytorch.org/whl/cu118
```

#### 모델 파일 준비
```bash
# 모델 디렉토리 생성
mkdir -p models/lstm
mkdir -p models/transformer
mkdir -p models/ensemble
```

### 5. 애플리케이션 시작

#### 백엔드 서버 시작
```bash
cd backend

# 개발 모드
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 프로덕션 모드
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### Celery Worker 시작
```bash
cd backend

# Celery Worker 시작
celery -A app.celery_app worker --loglevel=info

# Celery Beat 시작 (스케줄링)
celery -A app.celery_app beat --loglevel=info
```

#### 프론트엔드 서버 시작
```bash
cd frontend

# 개발 모드
npm run dev

# 프로덕션 빌드
npm run build
npm run preview
```

## 프로덕션 배포

### 1. Docker 배포 (권장)

#### Docker Compose 설정
```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://kpi_user:password@postgres:5432/kpi_dashboard
      - MONGODB_URL=mongodb://mongo:27017/kpi_dashboard
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - mongo
      - redis

  celery-worker:
    build: ./backend
    command: celery -A app.celery_app worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql://kpi_user:password@postgres:5432/kpi_dashboard
      - MONGODB_URL=mongodb://mongo:27017/kpi_dashboard
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - mongo
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=kpi_dashboard
      - POSTGRES_USER=kpi_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine

volumes:
  postgres_data:
  mongo_data:
```

#### 배포 실행
```bash
# Docker Compose로 배포
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

### 2. 수동 배포

#### Nginx 설정
```nginx
# /etc/nginx/sites-available/kpi-dashboard
server {
    listen 80;
    server_name your-domain.com;

    # 프론트엔드
    location / {
        root /var/www/kpi-dashboard/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # 백엔드 API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Systemd 서비스 설정
```ini
# /etc/systemd/system/kpi-backend.service
[Unit]
Description=KPI Dashboard Backend
After=network.target

[Service]
Type=simple
User=kpi
WorkingDirectory=/opt/kpi-dashboard/backend
Environment=PATH=/opt/kpi-dashboard/venv/bin
ExecStart=/opt/kpi-dashboard/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/kpi-celery.service
[Unit]
Description=KPI Dashboard Celery Worker
After=network.target

[Service]
Type=simple
User=kpi
WorkingDirectory=/opt/kpi-dashboard/backend
Environment=PATH=/opt/kpi-dashboard/venv/bin
ExecStart=/opt/kpi-dashboard/venv/bin/celery -A app.celery_app worker --loglevel=info
Restart=always

[Install]
WantedBy=multi-user.target
```

## 모니터링 및 로깅

### 1. 로그 설정
```python
# backend/app/utils/logging_config.py
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        }
    },
    "handlers": {
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "/var/log/kpi-dashboard/app.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "default"
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["file"]
    }
}
```

### 2. 헬스 체크
```bash
# 백엔드 헬스 체크
curl http://localhost:8000/health

# 프론트엔드 접근 확인
curl http://localhost:5173
```

### 3. 성능 모니터링
```bash
# 시스템 리소스 모니터링
htop
iotop
nvidia-smi  # GPU 사용량 (GPU 사용 시)

# 애플리케이션 로그 모니터링
tail -f /var/log/kpi-dashboard/app.log
```

## 보안 설정

### 1. 방화벽 설정
```bash
# UFW 방화벽 설정 (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. SSL/TLS 설정
```bash
# Let's Encrypt SSL 인증서 설치
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. 데이터베이스 보안
```sql
-- PostgreSQL 사용자 권한 제한
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kpi_user;
```

## 백업 및 복구

### 1. 데이터베이스 백업
```bash
# PostgreSQL 백업
pg_dump kpi_dashboard > backup_$(date +%Y%m%d_%H%M%S).sql

# MongoDB 백업
mongodump --db kpi_dashboard --out backup_$(date +%Y%m%d_%H%M%S)
```

### 2. 모델 파일 백업
```bash
# ML 모델 백업
tar -czf models_backup_$(date +%Y%m%d_%H%M%S).tar.gz models/
```

### 3. 자동 백업 스크립트
```bash
#!/bin/bash
# /opt/kpi-dashboard/scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/kpi-dashboard"

# 디렉토리 생성
mkdir -p $BACKUP_DIR

# PostgreSQL 백업
pg_dump kpi_dashboard > $BACKUP_DIR/postgres_$DATE.sql

# MongoDB 백업
mongodump --db kpi_dashboard --out $BACKUP_DIR/mongo_$DATE

# 모델 파일 백업
tar -czf $BACKUP_DIR/models_$DATE.tar.gz models/

# 30일 이상 된 백업 삭제
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "mongo_*" -mtime +30 -exec rm -rf {} \;
find $BACKUP_DIR -name "models_*.tar.gz" -mtime +30 -delete
```

## 문제 해결

### 1. 일반적인 문제

#### 백엔드 서버 시작 실패
```bash
# 포트 충돌 확인
netstat -tulpn | grep :8000

# 로그 확인
tail -f /var/log/kpi-dashboard/app.log
```

#### Celery Worker 연결 실패
```bash
# Redis 연결 확인
redis-cli ping

# Celery 상태 확인
celery -A app.celery_app inspect active
```

#### GPU 메모리 부족
```bash
# GPU 메모리 사용량 확인
nvidia-smi

# 모델 배치 크기 조정
# backend/app/ml/config.py에서 batch_size 줄이기
```

### 2. 성능 최적화

#### 데이터베이스 최적화
```sql
-- PostgreSQL 인덱스 생성
CREATE INDEX idx_timestamp ON kpi_data(timestamp);
CREATE INDEX idx_metric_name ON kpi_data(metric_name);

-- MongoDB 인덱스 생성
db.kpi_data.createIndex({"timestamp": 1})
db.kpi_data.createIndex({"metric_name": 1})
```

#### 캐싱 설정
```python
# Redis 캐싱 활성화
CACHE_ENABLED = True
CACHE_TTL = 3600  # 1시간
```

## 업데이트 및 유지보수

### 1. 애플리케이션 업데이트
```bash
# 코드 업데이트
git pull origin main

# 의존성 업데이트
pip install -r requirements.txt --upgrade
npm install --upgrade

# 서비스 재시작
sudo systemctl restart kpi-backend
sudo systemctl restart kpi-celery
```

### 2. 모델 업데이트
```bash
# 새 모델 파일 배포
cp new_model.pth models/lstm/
cp new_transformer.pth models/transformer/

# 모델 캐시 클리어
redis-cli FLUSHALL
```

### 3. 데이터베이스 마이그레이션
```bash
# Alembic 마이그레이션 (PostgreSQL)
alembic upgrade head

# MongoDB 스키마 업데이트
python scripts/migrate_mongodb.py
```

## 지원 및 연락처

### 기술 지원
- **이메일**: support@kpi-dashboard.com
- **문서**: https://docs.kpi-dashboard.com
- **GitHub**: https://github.com/kpi-dashboard

### 긴급 연락처
- **시스템 관리자**: admin@kpi-dashboard.com
- **개발팀**: dev@kpi-dashboard.com

---

**버전**: 1.0.0  
**최종 업데이트**: 2025-08-25  
**작성자**: AI Assistant
