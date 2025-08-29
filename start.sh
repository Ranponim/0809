#!/bin/bash
# Analysis LLM MCP Server 시작 스크립트

echo "🚀 Analysis LLM MCP Server 시작 중..."

# 환경 변수 로드
if [ -f /app/.env ]; then
    echo "📋 환경 변수 파일 로드 중..."
    set -a
    source /app/.env
    set +a
    echo "✅ 환경 변수 로드 완료"
fi

# 로그 디렉토리 확인
mkdir -p /app/logs
echo "📁 로그 디렉토리 생성 완료"

# 기본 환경 변수 설정
export PYTHONPATH=/app:$PYTHONPATH
export LOG_LEVEL=${LOG_LEVEL:-INFO}

echo "🐍 Python 경로: $PYTHONPATH"
echo "📊 로그 레벨: $LOG_LEVEL"

# MCP 서버 실행
echo "🔧 MCP 서버 시작..."
exec python -m analysis_llm.mcp_server "$@"



