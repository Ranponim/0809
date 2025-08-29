#!/bin/bash

# Analysis LLM 시스템 Docker 배포 스크립트
# 사용법: ./deploy.sh [옵션]

set -e  # 오류 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 기본 설정
PROJECT_NAME="analysis-llm"
COMPOSE_FILE="docker-compose.mcp.yml"
ENV_FILE=".env"

# 함수 정의
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 도움말 함수
show_help() {
    echo "Analysis LLM Docker 배포 스크립트"
    echo ""
    echo "사용법:"
    echo "  $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -h, --help          도움말 표시"
    echo "  -b, --build         이미지 빌드 후 배포"
    echo "  -d, --deploy        서비스 배포"
    echo "  -s, --stop          서비스 중지"
    echo "  -r, --restart       서비스 재시작"
    echo "  -l, --logs          로그 확인"
    echo "  -c, --clean         정리 (컨테이너, 이미지, 볼륨 삭제)"
    echo "  -m, --monitor       모니터링 대시보드 열기"
    echo "  --status            서비스 상태 확인"
    echo "  --backup            데이터베이스 백업"
    echo "  --restore <file>    데이터베이스 복원"
    echo ""
    echo "환경 변수:"
    echo "  .env 파일이 존재해야 합니다. docker-env.example을 참고하세요."
}

# 환경 파일 확인
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        log_error ".env 파일이 존재하지 않습니다."
        log_info "docker-env.example을 .env로 복사하고 설정하세요:"
        echo "  cp docker-env.example .env"
        echo "  # .env 파일을 열어서 실제 값으로 수정하세요"
        exit 1
    fi

    log_success ".env 파일 확인됨"
}

# Docker 및 Docker Compose 확인
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되어 있지 않습니다."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose가 설치되어 있지 않습니다."
        exit 1
    fi

    log_success "Docker 및 Docker Compose 확인됨"
}

# 이미지 빌드
build_images() {
    log_info "Docker 이미지 빌드 중..."

    # MCP 서버 이미지 빌드
    docker build -f Dockerfile.mcp -t ${PROJECT_NAME}-mcp:latest .

    log_success "이미지 빌드 완료"
}

# 서비스 배포
deploy_services() {
    log_info "서비스 배포 중..."

    if command -v docker-compose &> /dev/null; then
        docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d
    else
        docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d
    fi

    log_success "서비스 배포 완료"

    # 헬스 체크 대기
    log_info "서비스 시작 대기 중..."
    sleep 10

    # 상태 확인
    show_status
}

# 서비스 중지
stop_services() {
    log_info "서비스 중지 중..."

    if command -v docker-compose &> /dev/null; then
        docker-compose -f $COMPOSE_FILE down
    else
        docker compose -f $COMPOSE_FILE down
    fi

    log_success "서비스 중지 완료"
}

# 서비스 재시작
restart_services() {
    log_info "서비스 재시작 중..."
    stop_services
    deploy_services
}

# 로그 확인
show_logs() {
    log_info "서비스 로그 확인 중..."

    if command -v docker-compose &> /dev/null; then
        docker-compose -f $COMPOSE_FILE logs -f
    else
        docker compose -f $COMPOSE_FILE logs -f
    fi
}

# 서비스 상태 확인
show_status() {
    log_info "서비스 상태 확인 중..."

    echo ""
    echo "=== 컨테이너 상태 ==="
    docker ps --filter "label=service" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    echo ""
    echo "=== 서비스 헬스 체크 ==="

    # MCP 서버 헬스 체크
    if docker ps | grep -q analysis-llm-mcp; then
        echo "MCP 서버: 🟢 실행 중"
    else
        echo "MCP 서버: 🔴 중지됨"
    fi

    # PostgreSQL 헬스 체크
    if docker ps | grep -q analysis-postgres; then
        echo "PostgreSQL: 🟢 실행 중"
    else
        echo "PostgreSQL: 🔴 중지됨"
    fi

    # Redis 헬스 체크
    if docker ps | grep -q analysis-redis; then
        echo "Redis: 🟢 실행 중"
    else
        echo "Redis: 🟡 선택사항 (미사용)"
    fi

    echo ""
    echo "=== 네트워크 정보 ==="
    docker network ls | grep analysis

    echo ""
    echo "=== 볼륨 정보 ==="
    docker volume ls | grep analysis
}

# 정리
cleanup() {
    log_warning "정리 작업을 시작합니다. 이 작업은 데이터를 삭제할 수 있습니다."

    read -p "계속하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "작업이 취소되었습니다."
        exit 0
    fi

    log_info "컨테이너 중지 및 삭제 중..."
    if command -v docker-compose &> /dev/null; then
        docker-compose -f $COMPOSE_FILE down -v --remove-orphans
    else
        docker compose -f $COMPOSE_FILE down -v --remove-orphans
    fi

    log_info "이미지 삭제 중..."
    docker rmi ${PROJECT_NAME}-mcp:latest 2>/dev/null || true

    log_info "네트워크 삭제 중..."
    docker network rm analysis-network 2>/dev/null || true

    log_success "정리 완료"
}

# 모니터링 대시보드
open_monitoring() {
    log_info "모니터링 대시보드 열기"

    # Grafana
    if docker ps | grep -q analysis-grafana; then
        log_success "Grafana: http://localhost:3001 (admin/admin)"
    else
        log_warning "Grafana가 실행되지 않고 있습니다."
    fi

    # Prometheus
    if docker ps | grep -q analysis-prometheus; then
        log_success "Prometheus: http://localhost:9090"
    else
        log_warning "Prometheus가 실행되지 않고 있습니다."
    fi
}

# 백업
backup_database() {
    log_info "데이터베이스 백업 중..."

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="backup_${TIMESTAMP}.sql"

    docker exec analysis-postgres pg_dump -U kpi_user -d kpi_db > $BACKUP_FILE

    log_success "백업 파일 생성: $BACKUP_FILE"
}

# 복원
restore_database() {
    BACKUP_FILE=$1

    if [ -z "$BACKUP_FILE" ]; then
        log_error "백업 파일을 지정해야 합니다."
        echo "사용법: $0 --restore <backup_file>"
        exit 1
    fi

    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "백업 파일이 존재하지 않습니다: $BACKUP_FILE"
        exit 1
    fi

    log_info "데이터베이스 복원 중: $BACKUP_FILE"

    docker exec -i analysis-postgres psql -U kpi_user -d kpi_db < $BACKUP_FILE

    log_success "데이터베이스 복원 완료"
}

# 메인 로직
main() {
    # 기본 설정 확인
    check_env
    check_docker

    case "${1:-}" in
        -h|--help)
            show_help
            ;;
        -b|--build)
            build_images
            ;;
        -d|--deploy)
            deploy_services
            ;;
        -s|--stop)
            stop_services
            ;;
        -r|--restart)
            restart_services
            ;;
        -l|--logs)
            show_logs
            ;;
        -c|--clean)
            cleanup
            ;;
        -m|--monitor)
            open_monitoring
            ;;
        --status)
            show_status
            ;;
        --backup)
            backup_database
            ;;
        --restore)
            restore_database "$2"
            ;;
        *)
            log_info "기본 작업: 빌드 후 배포"
            build_images
            deploy_services
            ;;
    esac
}

# 스크립트 실행
main "$@"



