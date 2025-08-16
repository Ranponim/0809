## 로컬 PC 배포 가이드 (Docker 이미지 save/load/run)

### 개요
현재 PC에서 실행 중인 KPI 대시보드(Frontend/Backend/MongoDB)를 다른 로컬 PC로 이전하는 표준 절차입니다. 이미지를 저장(save)하고 대상 PC에서 로드(load)하여 docker compose 또는 docker run 방식으로 기동합니다. 

> MCP(LLM) 실제 호출은 대상 PC의 백엔드 컨테이너 환경변수 `MCP_ANALYZER_URL`이 설정되어 있을 때 자동 사용되며, 미설정/오류 시 Mock으로 폴백합니다.

### 전제 조건
- 양쪽 PC에 Docker Desktop(Windows) 또는 Docker Engine(리눅스/맥) 설치
- 현재 PC에 빌드된 이미지 존재: `kpi-backend:latest`, `kpi-frontend:latest` (권장: `mongo:7` 포함)
- 프로젝트 디렉터리와 `docker-compose.yml`(및 필요한 `.env`)을 함께 이전

### 이동할 산출물
- Docker 이미지: `kpi-backend:latest`, `kpi-frontend:latest`, `mongo:7`
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
docker save -o mongo_latest.tar mongo:7
```

번들 저장(권장, 한 파일로 이동)
```powershell
docker save -o kpi_images_bundle.tar kpi-backend:latest kpi-frontend:latest mongo:7
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

> compose 파일의 `image` 태그가 로드된 태그(`kpi-backend:latest`, `kpi-frontend:latest`, `mongo:7`)와 일치해야 `--no-build`가 제대로 동작합니다.

> MCP 실제 호출을 사용하려면 `.env` 또는 compose 환경변수에 아래를 추가하세요:
```env
MCP_ANALYZER_URL=http://mcp-host:8001/analyze
MCP_API_KEY=optional-key
```

---

## 5) 실행 방법 B: docker run으로 개별 실행(대안, 기본 bridge 네트워크 사용)

볼륨 생성(데이터 지속화)
```powershell
docker volume create mongo_data
```

MongoDB (기본 bridge 네트워크 사용)
```powershell
docker run -d --name kpi-mongo -p 27017:27017 -v mongo_data:/data/db mongo:7
```

Backend (환경변수는 실제 환경에 맞게 조정)
```powershell
docker run -d --name kpi-backend -p 8000:8000 ^
  --link kpi-mongo:kpi-mongo ^
  -e MONGO_URI="mongodb://kpi-mongo:27017/kpi" ^
  -e BACKEND_LOG_LEVEL="info" ^
  -e CORS_ORIGINS="http://localhost:5173" ^
  -e MCP_ANALYZER_URL="http://mcp-host:8001/analyze" ^
  -e MCP_API_KEY="optional-key" ^
  kpi-backend:latest
```

Frontend (백엔드 주소 노출 방식에 따라 필요 시 조정)
```powershell
docker run -d --name kpi-frontend -p 5173:80 ^
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
docker save -o kpi_v1.0.0_bundle.tar kpi-backend:v1.0.0 kpi-frontend:v1.0.0 mongo:7
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
docker save -o kpi_images_bundle.tar kpi-backend:latest kpi-frontend:latest mongo:7
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

## 부록: WSL(Windows) 환경 예시 및 주의사항

Windows PowerShell/명령 프롬프트에서 WSL(Ubuntu 등) 내부의 Docker CLI를 호출해 작업할 수 있습니다. 경로는 `/mnt/<드라이브문자>/...`로 매핑됩니다.

### 사전 준비
- Docker Desktop 실행 및 WSL 통합 활성화: Docker Desktop → Settings → Resources → WSL integration → 사용 중인 배포판 체크
- 배포판/버전 확인: `wsl -l -v`
- PowerShell에서 WSL 명령 실행 패턴: `wsl -e bash -lc "<리눅스 명령들>"`

### 이미지 로드(save→load)
```powershell
# 예: Windows 경로의 tar를 WSL에서 로드
wsl -e bash -lc "docker load -i /mnt/d/Coding/0809/kpi-backend_latest.tar"
wsl -e bash -lc "docker load -i /mnt/d/Coding/0809/kpi-frontend_latest.tar"
wsl -e bash -lc "docker load -i /mnt/d/Coding/0809/mongo_latest.tar"

# 로드 확인
wsl -e bash -lc "docker images | grep -E 'kpi-|mongo' || true"
```

### 버전 태그 맞추기(중요)
`docker-compose.yml`의 Mongo 버전이 `mongo:7`인 경우, 로드된 이미지가 `mongo:6`이라면 태그를 맞춰주세요.
```powershell
wsl -e bash -lc "docker tag mongo:6 mongo:7"
```

### compose로 기동/재기동
```powershell
# 프로젝트 디렉터리로 이동 후 기동(빌드 없이 로드된 이미지만 사용)
wsl -e bash -lc "cd /mnt/d/Coding/0809/kpi_dashboard && docker compose up -d --no-build"

# 특정 서비스만 강제 재생성(예: Mongo)
wsl -e bash -lc "cd /mnt/d/Coding/0809/kpi_dashboard && docker compose up -d --force-recreate --no-deps mongo"

# 백엔드/프론트엔드 재빌드(WSL에서 무캐시 빌드)
wsl -e bash -lc "cd /mnt/d/Coding/0809/kpi_dashboard && docker compose build backend --no-cache && docker compose build frontend --no-cache && docker compose up -d"
```

### 상태/로그/헬스 확인
```powershell
wsl -e bash -lc "cd /mnt/d/Coding/0809/kpi_dashboard && docker compose ps"
wsl -e bash -lc "docker logs -f kpi-mongo | tail -n 100"
wsl -e bash -lc "docker logs -f kpi-backend | tail -n 100"
```

### 환경변수 적용(MCP 등)
`.env`는 `kpi_dashboard/` 폴더에 두면 compose가 자동 로드합니다.
```env
# 파일: D:\Coding\0809\kpi_dashboard\.env (WSL에서는 /mnt/d/Coding/0809/kpi_dashboard/.env)
MCP_ANALYZER_URL=http://mcp-host:8001/analyze
MCP_API_KEY=optional-key
```

### 트러블슈팅(WSL)
- "Cannot connect to the Docker daemon": Docker Desktop이 실행 중인지 확인. `docker context ls`로 컨텍스트가 `default`(desktop)인지 확인 후 `docker context use default` 시도
- PowerShell에서 `grep`, `sed` 미인식: 해당 유틸은 리눅스 도구입니다. 반드시 `wsl -e bash -lc "... | grep ..."` 형태로 WSL 내부에서 실행하세요
- 경로 이슈: Windows 경로는 WSL에서 `/mnt/d/...`로 접근. 공백/특수문자는 작은따옴표 또는 이스케이프 처리
- Mongo 버전 불일치로 pull/빌드 시도: 위의 "버전 태그 맞추기" 절차로 `mongo:7` 태그를 보정

---

## 참고 및 권장 사항
- 완전 오프라인 환경이면 `mongo:7` 이미지도 반드시 함께 save/load 하세요.
- `docker-compose.yml`의 `image` 태그가 로드된 태그와 일치해야 `--no-build`로 바로 실행됩니다.
- 환경변수(`MONGO_URI`, `CORS_ORIGINS`, 프론트의 `BACKEND_BASE_URL`, 백엔드의 `MCP_ANALYZER_URL`)는 대상 환경에 맞게 조정하세요.
- 비밀정보(.env)는 소스관리 제외 및 안전한 방법으로 전달하세요.



---

## 리눅스 환경: `/mnt/bind-mount/` 바인드 마운트 기반 구성 가이드

### 목적
다른 팀에서 이미 사용 중인 리눅스 환경처럼, 각 컨테이너가 호스트의 `/mnt/bind-mount/<서비스>` 디렉토리를 바인드 마운트하여 운영/개발합니다. 호스트에서 코드를 수정하고 컨테이너를 재시작하면 변경 사항이 반영되는 워크플로우를 구성합니다.

### 전제 조건
- 이미지를 로컬에 로드 완료: `kpi-backend:latest`, `kpi-frontend:latest`, `mongo:7`
- 호스트 리눅스에 `/mnt/bind-mount/` 경로 사용 가능 (권한 확보)
- 현재 저장소의 `docker-compose.yml`을 그대로 사용하고, 추가로 override 파일로 바인드 마운트를 적용

### 1) 호스트 디렉토리 표준 레이아웃 만들기
```bash
sudo mkdir -p /mnt/bind-mount/kpi-mongo/data
sudo mkdir -p /mnt/bind-mount/kpi-backend
sudo mkdir -p /mnt/bind-mount/kpi-frontend

# 권한(예: 현재 사용자 UID:GID가 1000:1000인 경우)
sudo chown -R $USER:$USER /mnt/bind-mount
```

권장 레이아웃
```
/mnt/bind-mount/
  ├─ kpi-mongo/
  │   └─ data/               # MongoDB 데이터 영구화 디렉토리
  ├─ kpi-backend/            # 백엔드 앱 소스(호스트에서 수정)
  └─ kpi-frontend/           # 프론트엔드 빌드 산출물(dist) 또는 소스(옵션)
```

### 2) 백엔드 소스를 호스트에 준비
- 방법 A: 현재 저장소의 `kpi_dashboard/backend` 내용을 통째로 복사
```bash
rsync -a --delete kpi_dashboard/backend/ /mnt/bind-mount/kpi-backend/
```
- 방법 B: 별도 저장소/브랜치를 `git clone`하여 `/mnt/bind-mount/kpi-backend`로 가져오기

이후 호스트에서 `/mnt/bind-mount/kpi-backend` 내 코드를 수정하고, 컨테이너 재시작 시 반영됩니다.

### 3) 프론트엔드 정적 배포(nginx)용 빌드 산출물 준비
현재 `kpi-frontend:latest` 이미지는 nginx 런타임으로 `dist` 정적 파일을 서빙합니다. 바인드 마운트로 운영하려면 호스트에서 `dist`를 만들어 nginx 컨테이너에 마운트합니다.

호스트에서 빌드 생성(로컬에 Node가 없으면 컨테이너로 빌드 권장):
```bash
# 원본 소스가 ./kpi_dashboard/frontend 에 있을 때
rsync -a --delete kpi_dashboard/frontend/ /mnt/bind-mount/kpi-frontend-src/

# 컨테이너로 빌드 → /mnt/bind-mount/kpi-frontend/dist 생성
docker run --rm \
  -v /mnt/bind-mount/kpi-frontend-src:/app \
  -v /mnt/bind-mount/kpi-frontend:/out \
  -w /app node:20-alpine sh -lc "\
    if [ -f package-lock.json ]; then npm ci; else npm i; fi && \
    npm run build && \
    mkdir -p /out && cp -a dist/. /out/dist/"

# dist 확인
ls -lah /mnt/bind-mount/kpi-frontend/dist
```

참고: 개발 단계에서 Vite dev 서버를 쓰고 싶다면 아래 "프론트엔드 개발 모드(옵션)"를 참고하세요.

### 4) compose override 파일로 바인드 마운트 적용
프로젝트 루트(예: `/path/to/project`)에 `docker-compose.bind.yml` 파일을 하나 만들어 기본 compose를 덮어씌웁니다.

```yaml
version: "3.9"
services:
  mongo:
    volumes:
      - /mnt/bind-mount/kpi-mongo/data:/data/db

  backend:
    # 이미지 로드 전제: kpi-backend:latest
    volumes:
      - /mnt/bind-mount/kpi-backend:/app
    environment:
      # 예: compose 기본값을 덮어써야 할 때 사용
      MONGO_URL: ${MONGO_URL:-mongodb://mongo:27017}
      MONGO_DB_NAME: ${MONGO_DB_NAME:-kpi}

  frontend:
    # nginx 정적 서빙 경로에 빌드 산출물 dist 마운트
    volumes:
      - /mnt/bind-mount/kpi-frontend/dist:/usr/share/nginx/html:ro
```

실행:
```bash
cd /path/to/project
docker compose -f docker-compose.yml -f docker-compose.bind.yml up -d --no-build
```

### 5) 변경 반영 워크플로우
- 백엔드 코드 수정 → 재시작만으로 반영
```bash
# 코드 수정은 /mnt/bind-mount/kpi-backend 에서 진행
docker compose restart backend
docker compose logs backend --tail=100
```
  - 의존성(requirements.txt) 변경 시에는 이미지 재빌드가 필요합니다. 간단히 컨테이너 내에서 임시로 설치해 볼 수도 있으나, 재현성과 일관성을 위해 빌드/로드를 권장합니다.
  ```bash
  # 임시(권장 X): 컨테이너 안에서 pip 설치
  docker exec -it kpi-backend sh -lc "pip install -r requirements.txt"
  ```

- 프론트엔드(nginx 정적) 수정 → 호스트에서 다시 빌드 후 재시작
```bash
# 빌드 재수행 (위 3) 절차 반복 → dist 갱신)
docker compose restart frontend
```

### 6) 프론트엔드 개발 모드(옵션)
nginx 정적 배포 대신 개발 편의를 위해 Vite dev 서버 컨테이너를 별도 서비스로 띄울 수 있습니다. 아래를 `docker-compose.bind.yml`에 추가하고 필요 시 `frontend` 서비스는 중지하세요.

```yaml
services:
  frontend-dev:
    image: node:20-alpine
    container_name: kpi-frontend-dev
    working_dir: /app
    command: sh -lc "npm i && npm run dev -- --host 0.0.0.0"
    ports:
      - "5173:5173"
    volumes:
      - /mnt/bind-mount/kpi-frontend-src:/app
    environment:
      # 백엔드 주소 주입 (Vite: import.meta.env.VITE_*)
      - VITE_API_BASE_URL=${VITE_API_BASE_URL:-http://localhost:8000}
```

### 7) 권한/퍼미션 유의사항
- 컨테이너는 기본적으로 root(UID 0)로 실행됩니다. 호스트에서 생성되는 파일 소유권이 root가 되는 것이 싫다면, `user: "1000:1000"` 같은 설정을 서비스에 추가하거나, 사전에 `/mnt/bind-mount` 하위 디렉토리 권한을 조정하세요.
- SELinux/AppArmor 정책에 의해 마운트가 거부될 수 있습니다. 해당 보안 정책이 있는 배포판에서는 `:Z`(SELinux 컨텍스트) 같은 옵션이 필요할 수 있습니다.

### 8) 새 컨테이너를 동일 패턴으로 추가하기(템플릿)
다른 이미지를 같은 방식으로 운영하려면 `/mnt/bind-mount/<이름>` 디렉토리를 만들고, 아래처럼 override에 볼륨을 추가합니다.

```yaml
services:
  myservice:
    image: my-image:latest
    container_name: myservice
    volumes:
      - /mnt/bind-mount/myservice:/work
    ports:
      - "9000:9000"
    environment:
      - EXAMPLE_ENV=value
```

### 9) 운영 명령(요약)
```bash
# 상태/로그
docker compose ps
docker compose logs backend --tail=200

# 재시작
docker compose restart backend
docker compose restart frontend

# 중지/정리(데이터 보존)
docker compose down

# 볼륨 포함 정리(데이터 삭제 주의)
docker compose down -v
```

### 10) 트러블슈팅(바인드 마운트 특화)
- 컨테이너가 최신 코드를 못 읽음: 마운트 경로가 맞는지, 오버라이드 파일이 적용되었는지(`-f docker-compose.bind.yml`) 확인
- 프론트 정적 파일이 이전 상태로 보임: 브라우저 캐시 비우기, nginx 캐시 비활성화 확인, `dist` 재빌드 확인
- 권한 에러: `/mnt/bind-mount` 하위 소유권/퍼미션 점검, 필요 시 `user:` 지정
- 이미지 재빌드 요구: 의존성/런타임 변경은 바인드 마운트만으로 해결되지 않습니다. 새 이미지를 빌드(save)/로드(load) 후 재기동하세요.

