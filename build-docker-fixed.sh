#!/bin/bash

# Analysis LLM Docker ?��?지 빌드 ?�크립트
# ?�용�? ./build-docker.sh [production|development|all]

set -e  # ?�류 발생 ???�크립트 중단

# ?�상 ?�의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 ?�수??log_info() {
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

# 기본 변???�정
IMAGE_NAME="analysis-llm-mcp"
TAG=$(date +%Y%m%d-%H%M%S)
BUILD_TYPE=${1:-"all"}

# ?��?지 ?�그 ?�정
PROD_TAG="${IMAGE_NAME}:production-${TAG}"
DEV_TAG="${IMAGE_NAME}:development-${TAG}"
LATEST_PROD_TAG="${IMAGE_NAME}:latest-production"
LATEST_DEV_TAG="${IMAGE_NAME}:latest-development"

log_info "?? Analysis LLM Docker ?��?지 빌드 ?�작"
log_info "빌드 ?�?? ${BUILD_TYPE}"
log_info "?�?�스?�프 ?�그: ${TAG}"

# ?�로?�션 ?��?지 빌드 ?�수
build_production() {
    log_info "?�� ?�로?�션 ?��?지 빌드 ?�작..."
    log_info "?��?지: ${PROD_TAG}"

    if docker build -f Dockerfile.mcp -t "${PROD_TAG}" -t "${LATEST_PROD_TAG}" .; then
        log_success "?�로?�션 ?��?지 빌드 ?�료!"
        log_info "?�그??"
        log_info "  - ${PROD_TAG}"
        log_info "  - ${LATEST_PROD_TAG}"

        # ?��?지 ?�보 출력
        log_info "?��?지 ?�보:"
        docker images "${IMAGE_NAME}" | head -5

        return 0
    else
        log_error "?�로?�션 ?��?지 빌드 ?�패!"
        return 1
    fi
}

# 개발 ?��?지 빌드 ?�수
build_development() {
    log_info "?���? 개발 ?��?지 빌드 ?�작..."
    log_info "?��?지: ${DEV_TAG}"

    if docker build -f Dockerfile.dev -t "${DEV_TAG}" -t "${LATEST_DEV_TAG}" .; then
        log_success "개발 ?��?지 빌드 ?�료!"
        log_info "?�그??"
        log_info "  - ${DEV_TAG}"
        log_info "  - ${LATEST_DEV_TAG}"

        # ?��?지 ?�보 출력
        log_info "?��?지 ?�보:"
        docker images "${IMAGE_NAME}" | head -5

        return 0
    else
        log_error "개발 ?��?지 빌드 ?�패!"
        return 1
    fi
}

# 빌드 ?�?�에 ?�른 ?�행
case ${BUILD_TYPE} in
    "production")
        log_info "?�로?�션 ?��?지�?빌드?�니??"
        if build_production; then
            log_success "?�로?�션 ?��?지 빌드 ?�공!"
        else
            log_error "?�로?�션 ?��?지 빌드 ?�패!"
            exit 1
        fi
        ;;
    "development")
        log_info "개발 ?��?지�?빌드?�니??"
        if build_development; then
            log_success "개발 ?��?지 빌드 ?�공!"
        else
            log_error "개발 ?��?지 빌드 ?�패!"
            exit 1
        fi
        ;;
    "all")
        log_info "?�로?�션�?개발 ?��?지�?모두 빌드?�니??"

        if build_production && build_development; then
            log_success "모든 ?��?지 빌드 ?�공!"
            log_info ""
            log_info "빌드???��?지 목록:"
            docker images "${IMAGE_NAME}" | head -10
        else
            log_error "?��? ?��?지 빌드 ?�패!"
            exit 1
        fi
        ;;
    *)
        log_error "?�못??빌드 ?�?�입?�다. ?�용�? $0 [production|development|all]"
        exit 1
        ;;
esac

# 추�? ?�보 출력
log_info ""
log_info "?�� ?�용 방법:"
log_info ""
log_info "?�로?�션 ?�경 ?�행:"
log_info "  docker run -d --name analysis-llm-prod \\"
log_info "    -p 8000:8000 -p 8001:8001 -p 8002:8002 \\"
log_info "    -v \$(pwd)/logs:/app/logs \\"
log_info "    -v \$(pwd)/data:/app/data \\"
log_info "    -v \$(pwd)/config:/app/config \\"
log_info "    --env-file .env \\"
log_info "    ${LATEST_PROD_TAG}"
log_info ""
log_info "개발 ?�경 ?�행:"
log_info "  docker run -it --name analysis-llm-dev \\"
log_info "    -p 8000:8000 -p 8888:8888 \\"
log_info "    -v \$(pwd):/app \\"
log_info "    -v \$(pwd)/notebooks:/app/notebooks \\"
log_info "    --env-file .env \\"
log_info "    ${LATEST_DEV_TAG} bash"
log_info ""
log_info "Docker Compose ?�용:"
log_info "  docker-compose -f docker-compose.mcp.yml up -d"
log_info "  docker-compose -f docker-compose.dev.yml up -d"
log_info ""

log_success "?�� Docker ?��?지 빌드 ?�료!"
log_info "빌드???��?지?�을 ?�용?�보?�요!"

