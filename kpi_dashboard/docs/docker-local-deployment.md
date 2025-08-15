## 로컬 PC 배포 가이드 (Docker 이미지 save/load/run)

### 개요
현재 PC에서 실행 중인 KPI 대시보드(Frontend/Backend/MongoDB)를 다른 로컬 PC로 이전하는 표준 절차입니다. 이미지를 저장(save)하고 대상 PC에서 로드(load)하여 docker compose 또는 docker run 방식으로 기동합니다. 

> MCP(LLM) 실제 호출은 대상 PC의 백엔드 컨테이너 환경변수 `MCP_ANALYZER_URL`이 설정되어 있을 때 자동 사용되며, 미설정/오류 시 Mock으로 폴백합니다.

### 전제 조건
- 양쪽 PC에 Docker Desktop(Windows) 또는 Docker Engine(리눅스/맥) 설치
- 현재 PC에 빌드된 이미지 존재: `kpi-backend:latest`, `kpi-frontend:latest` (권장: `mongo:6` 포함)
- 프로젝트 디렉터리와 `docker-compose.yml`(및 필요한 `.env`)을 함께 이전

### 이동할 산출물
- Docker 이미지: `kpi-backend:latest`, `kpi-frontend:latest`, `mongo:6`
- 프로젝트 폴더: `kpi_dashboard/` (앱 소스, compose 파일, 설정 등)
- 필요 시 비밀키/환경 파일: `.env` 등(별도 안전 경로로 전달 권장)

---

## 1) 현재 PC에서 Docker 이미지 저장 (save)

이미지 확인
```powershell
docker images | findstr kpi-
docker images | findstr mongo
```

개별 저장
```powershell
docker save -o kpi-backend_latest.tar kpi-backend:latest
docker save -o kpi-frontend_latest.tar kpi-frontend:latest
docker save -o mongo_latest.tar mongo:6
```

번들 저장(권장, 한 파일로 이동)
```powershell
docker save -o kpi_images_bundle.tar kpi-backend:latest kpi-frontend:latest mongo:6
```

선택: 압축(전송 최적화)
```powershell
tar -a -c -f kpi_images_bundle.zip kpi_images_bundle.tar
```

> 프로젝트 폴더(예: `kpi_dashboard/` 전체, `.env` 포함)와 루트의 `docker-compose.yml`도 함께 복사하세요.

---

## 2) 파일 전송
USB/네트워크 드라이브/공유폴더 등으로 `kpi_images_bundle.tar`(또는 개별 `.tar`)와 프로젝트 디렉터리를 대상 PC로 복사합니다.

---

## 3) 대상 PC에서 Docker 이미지 로드 (load)

번들 로드(권장)
```powershell
docker load -i kpi_images_bundle.tar
```

개별 로드
```powershell
docker load -i kpi-backend_latest.tar
docker load -i kpi-frontend_latest.tar
docker load -i mongo_latest.tar
```

로드 확인
```powershell
docker images | findstr kpi-
docker images | findstr mongo
```

---

## 4) 실행 방법 A: docker compose로 실행(권장)

프로젝트 루트(예: `D:\Coding\0809\kpi_dashboard`)로 이동 후, 빌드 없이 로드된 이미지를 사용해 바로 실행합니다.
```powershell
cd D:\Coding\0809\kpi_dashboard
docker compose up -d --no-build
```

상태/로그 확인
```powershell
docker compose ps
docker compose logs backend --tail=100 | cat
docker compose logs frontend --tail=100 | cat
```

> compose 파일의 `image` 태그가 로드된 태그(`kpi-backend:latest`, `kpi-frontend:latest`, `mongo:6`)와 일치해야 `--no-build`가 제대로 동작합니다.

> MCP 실제 호출을 사용하려면 `.env` 또는 compose 환경변수에 아래를 추가하세요:
```env
MCP_ANALYZER_URL=http://mcp-host:8001/analyze
MCP_API_KEY=optional-key
```

---

## 5) 실행 방법 B: docker run으로 개별 실행(대안)

네트워크/볼륨 생성
```powershell
docker network create kpi-net
docker volume create mongo_data
```

MongoDB
```powershell
docker run -d --name kpi-mongo --network kpi-net -p 27017:27017 -v mongo_data:/data/db mongo:6
```

Backend (환경변수는 실제 환경에 맞게 조정)
```powershell
docker run -d --name kpi-backend --network kpi-net -p 8000:8000 ^
  -e MONGO_URI="mongodb://kpi-mongo:27017/kpi" ^
  -e BACKEND_LOG_LEVEL="info" ^
  -e CORS_ORIGINS="http://localhost:5173" ^
  -e MCP_ANALYZER_URL="http://mcp-host:8001/analyze" ^
  -e MCP_API_KEY="optional-key" ^
  kpi-backend:latest
```

Frontend (백엔드 주소 노출 방식에 따라 필요 시 조정)
```powershell
docker run -d --name kpi-frontend --network kpi-net -p 5173:80 ^
  -e BACKEND_BASE_URL="http://localhost:8000" ^
  kpi-frontend:latest
```

---

## 6) 동작 검증 체크리스트

백엔드 헬스/성능(엔드포인트는 환경에 맞게)
```powershell
curl http://localhost:8000/api/health | cat
curl http://localhost:8000/api/performance | cat
```

LLM 분석 트리거/결과
```powershell
$body = '{"user_id":"default", "n_minus_1":"2024-01-01_00:00~2024-01-01_23:59", "n":"2024-01-02_00:00~2024-01-02_23:59", "enable_mock": false}'
Invoke-RestMethod -Uri "http://localhost:8000/api/analysis/trigger-llm-analysis" -Method POST -Body $body -ContentType "application/json"
```

프론트엔드 접속
- 브라우저에서 `http://localhost:5173` 접속 → “분석 결과” 화면에서 상세 더블클릭(확대/기본 크기 확인)

---

## 7) 운영 중 자주 쓰는 관리 명령
```powershell
# 로그 보기
docker compose logs backend --tail=200 | cat
docker compose logs frontend --tail=200 | cat

# 재시작
docker compose restart backend
docker compose restart frontend

# 중지/정리
docker compose down

# 볼륨까지 정리(주의: 데이터 삭제)
docker compose down -v
```

---

## 8) 문제 해결 (Troubleshooting)

- 포트 충돌(예: 8000/5173/27017 사용 중)
  - 해결: 충돌 프로세스 종료 또는 `-p <HOST>:<CONTAINER>`에서 HOST 포트 변경
- compose가 이미지를 pull/빌드하려고 함
  - 원인: compose `image` 태그와 로드된 태그 불일치, 혹은 `build:` 섹션 활성화
  - 해결: compose에서 `image:`가 `kpi-backend:latest`, `kpi-frontend:latest`로 설정되어 있는지 확인, `--no-build` 사용
- CORS 오류
  - 해결: 백엔드 `CORS_ORIGINS` 환경변수에 프론트 주소(`http://localhost:5173`) 포함
- MongoDB 연결 실패
  - 해결: `MONGO_URI`가 `mongodb://kpi-mongo:27017/kpi`로 설정되었는지, 같은 네트워크인지 확인
- MCP가 항상 Mock으로 동작
  - 해결: 백엔드에 `MCP_ANALYZER_URL` 설정, 네트워크 접근 가능 여부 확인, 실패 시 로그에서 예외 메시지 확인

---

## 9) MongoDB 데이터 이전(선택)

컨테이너 내에서 덤프/복원
```powershell
# 덤프 (소스 PC)
docker exec kpi-mongo sh -c "mongodump -d kpi -o /dump && tar -czf /dump.tgz -C / dump"
docker cp kpi-mongo:/dump.tgz ./mongo_dump.tgz

# 복원 (대상 PC)
docker cp ./mongo_dump.tgz kpi-mongo:/dump.tgz
docker exec kpi-mongo sh -c "mkdir -p /restore && tar -xzf /dump.tgz -C /restore && mongorestore -d kpi /restore/dump/kpi"
```

> 볼륨 단위로 복사해도 되지만, 운영체제/스토리지에 따라 권장하지 않을 수 있습니다. `mongodump/mongorestore`가 가장 안전합니다.

---

## 10) 버전 관리/업데이트 권장

새 버전 태깅/저장
```powershell
docker tag kpi-backend:latest kpi-backend:v1.0.0
docker tag kpi-frontend:latest kpi-frontend:v1.0.0
docker save -o kpi_v1.0.0_bundle.tar kpi-backend:v1.0.0 kpi-frontend:v1.0.0 mongo:6
```

대상 PC 업데이트
```powershell
docker load -i kpi_v1.0.0_bundle.tar
docker compose up -d --no-build
```

---

## 부록: Linux/macOS 예시 명령

저장/로드
```bash
docker save -o kpi_images_bundle.tar kpi-backend:latest kpi-frontend:latest mongo:6
docker load -i kpi_images_bundle.tar
```

compose 실행
```bash
cd /path/to/kpi_dashboard
docker compose up -d --no-build
```

로그/상태
```bash
docker compose ps
docker compose logs backend --tail=100
docker compose logs frontend --tail=100
```

---

## 참고 및 권장 사항
- 완전 오프라인 환경이면 `mongo:6` 이미지도 반드시 함께 save/load 하세요.
- `docker-compose.yml`의 `image` 태그가 로드된 태그와 일치해야 `--no-build`로 바로 실행됩니다.
- 환경변수(`MONGO_URI`, `CORS_ORIGINS`, 프론트의 `BACKEND_BASE_URL`, 백엔드의 `MCP_ANALYZER_URL`)는 대상 환경에 맞게 조정하세요.
- 비밀정보(.env)는 소스관리 제외 및 안전한 방법으로 전달하세요.


