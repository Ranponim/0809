#!/bin/bash

# Analysis LLM Docker ?´ë?ì§€ ë¹Œë“œ ?¤í¬ë¦½íŠ¸
# ?¬ìš©ë²? ./build-docker.sh [production|development|all]

set -e  # ?¤ë¥˜ ë°œìƒ ???¤í¬ë¦½íŠ¸ ì¤‘ë‹¨

# ?‰ìƒ ?•ì˜
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ë¡œê·¸ ?¨ìˆ˜??log_info() {
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

# ê¸°ë³¸ ë³€???¤ì •
IMAGE_NAME="analysis-llm-mcp"
TAG=$(date +%Y%m%d-%H%M%S)
BUILD_TYPE=${1:-"all"}

# ?´ë?ì§€ ?œê·¸ ?¤ì •
PROD_TAG="${IMAGE_NAME}:production-${TAG}"
DEV_TAG="${IMAGE_NAME}:development-${TAG}"
LATEST_PROD_TAG="${IMAGE_NAME}:latest-production"
LATEST_DEV_TAG="${IMAGE_NAME}:latest-development"

log_info "?? Analysis LLM Docker ?´ë?ì§€ ë¹Œë“œ ?œì‘"
log_info "ë¹Œë“œ ?€?? ${BUILD_TYPE}"
log_info "?€?„ìŠ¤?¬í”„ ?œê·¸: ${TAG}"

# ?„ë¡œ?•ì…˜ ?´ë?ì§€ ë¹Œë“œ ?¨ìˆ˜
build_production() {
    log_info "?­ ?„ë¡œ?•ì…˜ ?´ë?ì§€ ë¹Œë“œ ?œì‘..."
    log_info "?´ë?ì§€: ${PROD_TAG}"

    if docker build -f Dockerfile.mcp -t "${PROD_TAG}" -t "${LATEST_PROD_TAG}" .; then
        log_success "?„ë¡œ?•ì…˜ ?´ë?ì§€ ë¹Œë“œ ?„ë£Œ!"
        log_info "?œê·¸??"
        log_info "  - ${PROD_TAG}"
        log_info "  - ${LATEST_PROD_TAG}"

        # ?´ë?ì§€ ?•ë³´ ì¶œë ¥
        log_info "?´ë?ì§€ ?•ë³´:"
        docker images "${IMAGE_NAME}" | head -5

        return 0
    else
        log_error "?„ë¡œ?•ì…˜ ?´ë?ì§€ ë¹Œë“œ ?¤íŒ¨!"
        return 1
    fi
}

# ê°œë°œ ?´ë?ì§€ ë¹Œë“œ ?¨ìˆ˜
build_development() {
    log_info "?› ï¸? ê°œë°œ ?´ë?ì§€ ë¹Œë“œ ?œì‘..."
    log_info "?´ë?ì§€: ${DEV_TAG}"

    if docker build -f Dockerfile.dev -t "${DEV_TAG}" -t "${LATEST_DEV_TAG}" .; then
        log_success "ê°œë°œ ?´ë?ì§€ ë¹Œë“œ ?„ë£Œ!"
        log_info "?œê·¸??"
        log_info "  - ${DEV_TAG}"
        log_info "  - ${LATEST_DEV_TAG}"

        # ?´ë?ì§€ ?•ë³´ ì¶œë ¥
        log_info "?´ë?ì§€ ?•ë³´:"
        docker images "${IMAGE_NAME}" | head -5

        return 0
    else
        log_error "ê°œë°œ ?´ë?ì§€ ë¹Œë“œ ?¤íŒ¨!"
        return 1
    fi
}

# ë¹Œë“œ ?€?…ì— ?°ë¥¸ ?¤í–‰
case ${BUILD_TYPE} in
    "production")
        log_info "?„ë¡œ?•ì…˜ ?´ë?ì§€ë§?ë¹Œë“œ?©ë‹ˆ??"
        if build_production; then
            log_success "?„ë¡œ?•ì…˜ ?´ë?ì§€ ë¹Œë“œ ?±ê³µ!"
        else
            log_error "?„ë¡œ?•ì…˜ ?´ë?ì§€ ë¹Œë“œ ?¤íŒ¨!"
            exit 1
        fi
        ;;
    "development")
        log_info "ê°œë°œ ?´ë?ì§€ë§?ë¹Œë“œ?©ë‹ˆ??"
        if build_development; then
            log_success "ê°œë°œ ?´ë?ì§€ ë¹Œë“œ ?±ê³µ!"
        else
            log_error "ê°œë°œ ?´ë?ì§€ ë¹Œë“œ ?¤íŒ¨!"
            exit 1
        fi
        ;;
    "all")
        log_info "?„ë¡œ?•ì…˜ê³?ê°œë°œ ?´ë?ì§€ë¥?ëª¨ë‘ ë¹Œë“œ?©ë‹ˆ??"

        if build_production && build_development; then
            log_success "ëª¨ë“  ?´ë?ì§€ ë¹Œë“œ ?±ê³µ!"
            log_info ""
            log_info "ë¹Œë“œ???´ë?ì§€ ëª©ë¡:"
            docker images "${IMAGE_NAME}" | head -10
        else
            log_error "?¼ë? ?´ë?ì§€ ë¹Œë“œ ?¤íŒ¨!"
            exit 1
        fi
        ;;
    *)
        log_error "?˜ëª»??ë¹Œë“œ ?€?…ì…?ˆë‹¤. ?¬ìš©ë²? $0 [production|development|all]"
        exit 1
        ;;
esac

# ì¶”ê? ?•ë³´ ì¶œë ¥
log_info ""
log_info "?“‹ ?¬ìš© ë°©ë²•:"
log_info ""
log_info "?„ë¡œ?•ì…˜ ?˜ê²½ ?¤í–‰:"
log_info "  docker run -d --name analysis-llm-prod \\"
log_info "    -p 8000:8000 -p 8001:8001 -p 8002:8002 \\"
log_info "    -v \$(pwd)/logs:/app/logs \\"
log_info "    -v \$(pwd)/data:/app/data \\"
log_info "    -v \$(pwd)/config:/app/config \\"
log_info "    --env-file .env \\"
log_info "    ${LATEST_PROD_TAG}"
log_info ""
log_info "ê°œë°œ ?˜ê²½ ?¤í–‰:"
log_info "  docker run -it --name analysis-llm-dev \\"
log_info "    -p 8000:8000 -p 8888:8888 \\"
log_info "    -v \$(pwd):/app \\"
log_info "    -v \$(pwd)/notebooks:/app/notebooks \\"
log_info "    --env-file .env \\"
log_info "    ${LATEST_DEV_TAG} bash"
log_info ""
log_info "Docker Compose ?¬ìš©:"
log_info "  docker-compose -f docker-compose.mcp.yml up -d"
log_info "  docker-compose -f docker-compose.dev.yml up -d"
log_info ""

log_success "?‰ Docker ?´ë?ì§€ ë¹Œë“œ ?„ë£Œ!"
log_info "ë¹Œë“œ???´ë?ì§€?¤ì„ ?¬ìš©?´ë³´?¸ìš”!"

