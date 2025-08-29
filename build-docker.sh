#!/bin/bash

# Analysis LLM Docker 이미지 빌드 스크립트
# 사용법: ./build-docker.sh [production|development|all]

set -e  # 오류 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들
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

# 기본 변수 설정
IMAGE_NAME="analysis-llm-mcp"
TAG=$(date +%Y%m%d-%H%M%S)
BUILD_TYPE=${1:-"all"}

# 이미지 태그 설정
PROD_TAG="${IMAGE_NAME}:production-${TAG}"
DEV_TAG="${IMAGE_NAME}:development-${TAG}"
LATEST_PROD_TAG="${IMAGE_NAME}:latest-production"
LATEST_DEV_TAG="${IMAGE_NAME}:latest-development"

log_info "🚀 Analysis LLM Docker 이미지 빌드 시작"
log_info "빌드 타입: ${BUILD_TYPE}"
log_info "타임스탬프 태그: ${TAG}"

# 프로덕션 이미지 빌드 함수
build_production() {
    log_info "🏭 프로덕션 이미지 빌드 시작..."
    log_info "이미지: ${PROD_TAG}"

    if docker build -f Dockerfile.mcp -t "${PROD_TAG}" -t "${LATEST_PROD_TAG}" .; then
        log_success "프로덕션 이미지 빌드 완료!"
        log_info "태그들:"
        log_info "  - ${PROD_TAG}"
        log_info "  - ${LATEST_PROD_TAG}"

        # 이미지 정보 출력
        log_info "이미지 정보:"
        docker images "${IMAGE_NAME}" | head -5

        return 0
    else
        log_error "프로덕션 이미지 빌드 실패!"
        return 1
    fi
}

# 개발 이미지 빌드 함수
build_development() {
    log_info "🛠️  개발 이미지 빌드 시작..."
    log_info "이미지: ${DEV_TAG}"

    if docker build -f Dockerfile.dev -t "${DEV_TAG}" -t "${LATEST_DEV_TAG}" .; then
        log_success "개발 이미지 빌드 완료!"
        log_info "태그들:"
        log_info "  - ${DEV_TAG}"
        log_info "  - ${LATEST_DEV_TAG}"

        # 이미지 정보 출력
        log_info "이미지 정보:"
        docker images "${IMAGE_NAME}" | head -5

        return 0
    else
        log_error "개발 이미지 빌드 실패!"
        return 1
    fi
}

# 빌드 타입에 따른 실행
case ${BUILD_TYPE} in
    "production")
        log_info "프로덕션 이미지만 빌드합니다."
        if build_production; then
            log_success "프로덕션 이미지 빌드 성공!"
        else
            log_error "프로덕션 이미지 빌드 실패!"
            exit 1
        fi
        ;;
    "development")
        log_info "개발 이미지만 빌드합니다."
        if build_development; then
            log_success "개발 이미지 빌드 성공!"
        else
            log_error "개발 이미지 빌드 실패!"
            exit 1
        fi
        ;;
    "all")
        log_info "프로덕션과 개발 이미지를 모두 빌드합니다."

        if build_production && build_development; then
            log_success "모든 이미지 빌드 성공!"
            log_info ""
            log_info "빌드된 이미지 목록:"
            docker images "${IMAGE_NAME}" | head -10
        else
            log_error "일부 이미지 빌드 실패!"
            exit 1
        fi
        ;;
    *)
        log_error "잘못된 빌드 타입입니다. 사용법: $0 [production|development|all]"
        exit 1
        ;;
esac

# 추가 정보 출력
log_info ""
log_info "📋 사용 방법:"
log_info ""
log_info "프로덕션 환경 실행:"
log_info "  docker run -d --name analysis-llm-prod \\"
log_info "    -p 8000:8000 -p 8001:8001 -p 8002:8002 \\"
log_info "    -v \$(pwd)/logs:/app/logs \\"
log_info "    -v \$(pwd)/data:/app/data \\"
log_info "    -v \$(pwd)/config:/app/config \\"
log_info "    --env-file .env \\"
log_info "    ${LATEST_PROD_TAG}"
log_info ""
log_info "개발 환경 실행:"
log_info "  docker run -it --name analysis-llm-dev \\"
log_info "    -p 8000:8000 -p 8888:8888 \\"
log_info "    -v \$(pwd):/app \\"
log_info "    -v \$(pwd)/notebooks:/app/notebooks \\"
log_info "    --env-file .env \\"
log_info "    ${LATEST_DEV_TAG} bash"
log_info ""
log_info "Docker Compose 사용:"
log_info "  docker-compose -f docker-compose.mcp.yml up -d"
log_info "  docker-compose -f docker-compose.dev.yml up -d"
log_info ""

log_success "🎉 Docker 이미지 빌드 완료!"
log_info "빌드된 이미지들을 사용해보세요!"



