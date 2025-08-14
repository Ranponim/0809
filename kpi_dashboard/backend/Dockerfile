FROM python:3.11-slim AS base

# 기본 환경 변수 설정: 버퍼링 비활성화, 바이트코드 생성 비활성화
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 필요한 파일만 먼저 복사하여 캐시 레이어 극대화
COPY requirements.txt /app/requirements.txt

# 의존성 설치 (깨끗한 격리 환경)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# 애플리케이션 소스 복사
COPY . /app

EXPOSE 8000

# Uvicorn 서버 실행 (DB 준비 대기 후 시작)
CMD ["sh", "-c", "python wait_for_db.py && uvicorn main:app --host 0.0.0.0 --port 8000"]


