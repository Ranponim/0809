#!/usr/bin/env python3
"""
Analysis LLM 모듈 임포트 테스트
"""

import sys
import os

# 현재 디렉토리를 Python 경로에 추가
sys.path.insert(0, os.getcwd())

try:
    print("🔍 Analysis LLM 모듈 임포트 테스트 시작...")
    import analysis_llm
    print("✅ Analysis LLM 모듈 임포트 성공!")

    # 버전 확인
    print(f"📦 버전: {analysis_llm.__version__}")
    print(f"👤 작성자: {analysis_llm.__author__}")

    # 주요 컴포넌트 임포트 테스트
    print("\n🔧 주요 컴포넌트 임포트 테스트...")
    from analysis_llm.service import AnalysisService
    print("✅ AnalysisService 임포트 성공")

    from analysis_llm.mcp_server import AnalysisMCPServer
    print("✅ AnalysisMCPServer 임포트 성공")

    from analysis_llm.core.config import get_settings
    print("✅ Core config 임포트 성공")

    print("\n🎉 모든 테스트 통과!")

except ImportError as e:
    print(f"❌ 임포트 오류: {e}")
    import traceback
    traceback.print_exc()

except Exception as e:
    print(f"❌ 기타 오류: {e}")
    import traceback
    traceback.print_exc()


