#!/usr/bin/env python3
"""
개발 환경 설정 스크립트
Host 필터링 기능 개발을 위한 기본 환경을 설정합니다.
"""

import os
import subprocess
import sys
import logging
from pathlib import Path

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def run_command(command: str, description: str) -> bool:
    """
    명령어를 실행하고 결과를 로그로 남깁니다.
    
    Args:
        command: 실행할 명령어
        description: 명령어 설명
        
    Returns:
        bool: 성공 여부
    """
    logging.info(f"실행 중: {description}")
    logging.info(f"명령어: {command}")
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=True,
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        logging.info(f"성공: {description}")
        if result.stdout:
            logging.debug(f"출력: {result.stdout}")
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"실패: {description}")
        logging.error(f"에러 코드: {e.returncode}")
        if e.stderr:
            logging.error(f"에러 메시지: {e.stderr}")
        return False
    except Exception as e:
        logging.error(f"예기치 못한 오류: {e}")
        return False

def check_python_version():
    """Python 버전을 확인합니다."""
    logging.info("Python 버전 확인 중...")
    version = sys.version_info
    logging.info(f"Python 버전: {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        logging.error("Python 3.8 이상이 필요합니다.")
        return False
    
    logging.info("Python 버전 요구사항 충족 ✓")
    return True

def install_dependencies():
    """의존성을 설치합니다."""
    logging.info("의존성 설치 시작...")
    
    # 루트 레벨 의존성 설치
    if not run_command("pip install -r requirements.txt", "루트 의존성 설치"):
        return False
    
    # 백엔드 의존성 설치
    if not run_command("pip install -r kpi_dashboard/backend/requirements.txt", "백엔드 의존성 설치"):
        return False
    
    # 개발 의존성 설치
    if not run_command("pip install black isort flake8 pre-commit pytest pytest-asyncio", "개발 의존성 설치"):
        return False
    
    logging.info("의존성 설치 완료 ✓")
    return True

def setup_pre_commit():
    """Pre-commit 훅을 설정합니다."""
    logging.info("Pre-commit 훅 설정 중...")
    
    if not run_command("pre-commit install", "Pre-commit 훅 설치"):
        return False
    
    # 기존 파일에 대해 pre-commit 실행
    if not run_command("pre-commit run --all-files", "모든 파일에 대해 pre-commit 실행"):
        logging.warning("Pre-commit 실행 중 일부 파일에서 문제가 발견되었습니다. 수정 후 다시 실행하세요.")
    
    logging.info("Pre-commit 훅 설정 완료 ✓")
    return True

def verify_installation():
    """설치가 올바르게 되었는지 확인합니다."""
    logging.info("설치 검증 중...")
    
    # 주요 라이브러리 임포트 테스트
    test_imports = [
        "pandas",
        "psycopg2",
        "pymongo",
        "pydantic",
        "validators",
        "dns.resolver"
    ]
    
    for module in test_imports:
        try:
            __import__(module)
            logging.info(f"  ✓ {module} 임포트 성공")
        except ImportError as e:
            logging.error(f"  ✗ {module} 임포트 실패: {e}")
            return False
    
    logging.info("설치 검증 완료 ✓")
    return True

def create_test_structure():
    """테스트 디렉토리 구조를 생성합니다."""
    logging.info("테스트 디렉토리 구조 생성 중...")
    
    test_dirs = [
        "tests",
        "tests/unit",
        "tests/integration",
        "tests/host_filter",
        "tests/fixtures"
    ]
    
    for test_dir in test_dirs:
        Path(test_dir).mkdir(parents=True, exist_ok=True)
        logging.info(f"  디렉토리 생성: {test_dir}")
    
    # 기본 테스트 파일 생성
    test_init_content = '''"""
Host 필터링 기능 테스트 모듈
"""
'''
    
    for test_dir in ["tests", "tests/unit", "tests/integration", "tests/host_filter"]:
        init_file = Path(test_dir) / "__init__.py"
        if not init_file.exists():
            init_file.write_text(test_init_content, encoding='utf-8')
            logging.info(f"  파일 생성: {init_file}")
    
    logging.info("테스트 디렉토리 구조 생성 완료 ✓")
    return True

def main():
    """메인 함수"""
    logging.info("=" * 50)
    logging.info("Host 필터링 기능 개발 환경 설정 시작")
    logging.info("=" * 50)
    
    # 1. Python 버전 확인
    if not check_python_version():
        sys.exit(1)
    
    # 2. 의존성 설치
    if not install_dependencies():
        sys.exit(1)
    
    # 3. Pre-commit 설정
    if not setup_pre_commit():
        sys.exit(1)
    
    # 4. 설치 검증
    if not verify_installation():
        sys.exit(1)
    
    # 5. 테스트 구조 생성
    if not create_test_structure():
        sys.exit(1)
    
    logging.info("=" * 50)
    logging.info("개발 환경 설정 완료! 🎉")
    logging.info("=" * 50)
    logging.info("다음 단계:")
    logging.info("1. git add . && git commit -m 'feat: 개발 환경 설정 완료'")
    logging.info("2. Host 필터링 기능 개발 시작")
    logging.info("=" * 50)

if __name__ == "__main__":
    main()
