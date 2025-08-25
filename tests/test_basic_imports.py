"""
기본 임포트 테스트
Host 필터링 기능에 필요한 라이브러리들이 올바르게 설치되었는지 확인합니다.
"""

import pytest
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_pandas_import():
    """pandas 라이브러리 임포트 테스트"""
    try:
        import pandas as pd
        logger.info("✓ pandas 임포트 성공")
        assert hasattr(pd, 'DataFrame')
    except ImportError as e:
        pytest.fail(f"pandas 임포트 실패: {e}")


def test_psycopg2_import():
    """psycopg2 라이브러리 임포트 테스트"""
    try:
        import psycopg2
        logger.info("✓ psycopg2 임포트 성공")
        assert hasattr(psycopg2, 'connect')
    except ImportError as e:
        pytest.fail(f"psycopg2 임포트 실패: {e}")


def test_pymongo_import():
    """pymongo 라이브러리 임포트 테스트"""
    try:
        import pymongo
        logger.info("✓ pymongo 임포트 성공")
        assert hasattr(pymongo, 'MongoClient')
    except ImportError as e:
        pytest.fail(f"pymongo 임포트 실패: {e}")


def test_pydantic_import():
    """pydantic 라이브러리 임포트 테스트"""
    try:
        from pydantic import BaseModel, ValidationError
        logger.info("✓ pydantic 임포트 성공")
        assert BaseModel is not None
        assert ValidationError is not None
    except ImportError as e:
        pytest.fail(f"pydantic 임포트 실패: {e}")


def test_validators_import():
    """validators 라이브러리 임포트 테스트"""
    try:
        import validators
        logger.info("✓ validators 임포트 성공")
        assert hasattr(validators, 'domain')
        assert hasattr(validators, 'ipv4')
    except ImportError as e:
        pytest.fail(f"validators 임포트 실패: {e}")


def test_dns_import():
    """dnspython 라이브러리 임포트 테스트"""
    try:
        import dns.resolver
        logger.info("✓ dnspython 임포트 성공")
        assert hasattr(dns.resolver, 'resolve')
    except ImportError as e:
        pytest.fail(f"dnspython 임포트 실패: {e}")


def test_ipaddress_import():
    """Python 표준 라이브러리 ipaddress 모듈 테스트"""
    try:
        import ipaddress
        logger.info("✓ ipaddress 임포트 성공")
        assert hasattr(ipaddress, 'ip_address')
        assert hasattr(ipaddress, 'ip_network')
    except ImportError as e:
        pytest.fail(f"ipaddress 임포트 실패: {e}")


def test_host_validation_basics():
    """호스트 검증 기본 기능 테스트"""
    import ipaddress
    import validators
    
    # IP 주소 검증
    valid_ipv4 = "192.168.1.1"
    assert ipaddress.ip_address(valid_ipv4)
    assert validators.ipv4(valid_ipv4)
    
    # 도메인명 검증
    valid_domain = "example.com"
    assert validators.domain(valid_domain)
    
    logger.info("✓ 기본 호스트 검증 기능 동작 확인")


if __name__ == "__main__":
    # 개별 실행을 위한 코드
    pytest.main([__file__, "-v"])
