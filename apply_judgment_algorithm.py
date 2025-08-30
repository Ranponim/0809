#!/usr/bin/env python3
"""
최영권 판단 알고리즘 적용 스크립트
이 파일을 사용하여 실제 워드 파일에서 판단 알고리즘을 로드하고 적용하세요.
"""

import os
import sys
from pathlib import Path

# 프로젝트 경로 설정
project_root = Path(__file__).parent / "analysis_llm"
sys.path.insert(0, str(project_root.parent))

def apply_judgment_algorithm(word_file_path: str):
    """
    최영권 판단 알고리즘을 적용하는 메인 함수

    Args:
        word_file_path: 워드 파일 경로
    """
    print("🚀 최영권 판단 알고리즘 적용")
    print("=" * 50)

    try:
        # 필요한 모듈 임포트
        from analysis_llm.service import AnalysisService
        from analysis_llm.judgment_algorithm_manager import JudgmentAlgorithmManager

        # 1. 판단 알고리즘 로드
        print(f"📁 워드 파일 로드: {word_file_path}")
        algorithm_manager = JudgmentAlgorithmManager(word_file_path)

        if not algorithm_manager.is_algorithm_loaded():
            print("❌ 판단 알고리즘 로드 실패")
            return False

        print("✅ 판단 알고리즘이 로드되었습니다!")

        # 2. Analysis Service에 설정
        print("🤖 Analysis Service에 알고리즘 설정")
        analysis_service = AnalysisService()
        algorithm_content = algorithm_manager.get_algorithm_content()
        analysis_service.set_judgment_algorithm(algorithm_content)

        print("✅ Analysis Service에 판단 알고리즘이 설정되었습니다!")
        print(f"📏 알고리즘 콘텐츠 길이: {len(algorithm_content)}자")

        # 3. 알고리즘 정보 출력
        info = algorithm_manager.get_algorithm_info()
        print("\n📋 알고리즘 정보:")
        print(f"  - 파일 경로: {info['file_path']}")
        print(f"  - 콘텐츠 길이: {info['content_length']}자")
        print(f"  - 로드 상태: {'성공' if info['is_loaded'] else '실패'}")

        print("\n🎉 최영권 판단 알고리즘이 성공적으로 적용되었습니다!")
        print("\n💡 이제 analysis_service를 사용하여 데이터를 분석하면")
        print("   자동으로 판단 알고리즘이 적용됩니다.")

        return True

    except ImportError as e:
        print(f"❌ 모듈 임포트 오류: {e}")
        print("필요한 모듈이 설치되어 있는지 확인하세요.")
        return False
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return False


def main():
    """메인 함수"""
    if len(sys.argv) != 2:
        print("사용법: python apply_judgment_algorithm.py <워드파일경로>")
        print("예시: python apply_judgment_algorithm.py 최영권_판단_알고리즘.docx")
        sys.exit(1)

    word_file_path = sys.argv[1]

    if not os.path.exists(word_file_path):
        print(f"❌ 파일을 찾을 수 없습니다: {word_file_path}")
        sys.exit(1)

    success = apply_judgment_algorithm(word_file_path)

    if success:
        print("\n✅ 준비 완료! 이제 다음 코드로 분석을 실행할 수 있습니다:")
        print("""
from analysis_llm.service import AnalysisService
from analysis_llm.judgment_algorithm_manager import JudgmentAlgorithmManager

# 알고리즘 로드 및 설정
algorithm_manager = JudgmentAlgorithmManager("최영권_판단_알고리즘.docx")
analysis_service = AnalysisService()
analysis_service.set_judgment_algorithm(algorithm_manager.get_algorithm_content())

# 데이터 분석 실행 (자동으로 판단 알고리즘이 적용됨)
result = analysis_service.analyze_cell_performance(your_data)
        """)
    else:
        print("\n❌ 적용 실패. 오류를 확인하고 다시 시도하세요.")
        sys.exit(1)


if __name__ == "__main__":
    main()




