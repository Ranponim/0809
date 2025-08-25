"""
타겟 검증 통합 테스트

새로운 target_validation 유틸리티와 기존 analysis_llm.py의 통합을 테스트합니다.
"""

import pytest
import logging
from unittest.mock import Mock, patch

# 테스트 대상 모듈 임포트
try:
    from kpi_dashboard.backend.app.utils.target_validation import (
        NEIDValidator,
        CellIDValidator, 
        HostValidator,
        validate_ne_cell_host_filters,
        to_list,
        ValidationResult
    )
    VALIDATION_MODULE_AVAILABLE = True
except ImportError as e:
    VALIDATION_MODULE_AVAILABLE = False
    pytest.skip(f"검증 모듈을 로드할 수 없습니다: {e}", allow_module_level=True)

# 로깅 설정
logging.basicConfig(level=logging.INFO)


class TestNEIDValidator:
    """NE ID 검증기 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.validator = NEIDValidator()
    
    def test_valid_ne_id_formats(self):
        """유효한 NE ID 형식 테스트"""
        valid_ne_ids = [
            "nvgnb#10000",
            "nvgnb#101086", 
            "enb#123",
            "gnb#456"
        ]
        
        for ne_id in valid_ne_ids:
            is_valid, error = self.validator.validate_format(ne_id)
            assert is_valid, f"'{ne_id}'는 유효해야 합니다: {error}"
    
    def test_invalid_ne_id_formats(self):
        """무효한 NE ID 형식 테스트"""
        invalid_ne_ids = [
            "invalid_ne",
            "nvgnb#",
            "#10000",
            "nvgnb10000",
            "",
            "nvgnb#abc"
        ]
        
        for ne_id in invalid_ne_ids:
            is_valid, error = self.validator.validate_format(ne_id)
            assert not is_valid, f"'{ne_id}'는 무효해야 합니다"
            assert error, "오류 메시지가 있어야 합니다"
    
    def test_multiple_ne_id_validation(self):
        """다중 NE ID 검증 테스트"""
        ne_ids = ["nvgnb#10000", "invalid_ne", "enb#123"]
        result = self.validator.validate_multiple(ne_ids)
        
        assert isinstance(result, ValidationResult)
        assert not result.is_valid  # invalid_ne 때문에 전체 실패
        assert len(result.valid_items) == 2
        assert len(result.invalid_items) == 1
        assert "invalid_ne" in result.invalid_items
        assert "invalid_ne" in result.validation_errors


class TestCellIDValidator:
    """Cell ID 검증기 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.validator = CellIDValidator()
    
    def test_valid_cell_id_formats(self):
        """유효한 Cell ID 형식 테스트"""
        valid_cell_ids = [
            "2010",
            2010,
            "8418",
            8418,
            "0",
            0
        ]
        
        for cell_id in valid_cell_ids:
            is_valid, error = self.validator.validate_format(cell_id)
            assert is_valid, f"'{cell_id}'는 유효해야 합니다: {error}"
    
    def test_invalid_cell_id_formats(self):
        """무효한 Cell ID 형식 테스트"""
        invalid_cell_ids = [
            "abc",
            "",
            -1,
            "-1",
            268435456,  # 범위 초과
            "2010.5"
        ]
        
        for cell_id in invalid_cell_ids:
            is_valid, error = self.validator.validate_format(cell_id)
            assert not is_valid, f"'{cell_id}'는 무효해야 합니다"
            assert error, "오류 메시지가 있어야 합니다"
    
    def test_multiple_cell_id_validation(self):
        """다중 Cell ID 검증 테스트"""
        cell_ids = ["2010", 8418, "invalid", -1]
        result = self.validator.validate_multiple(cell_ids)
        
        assert isinstance(result, ValidationResult)
        assert not result.is_valid
        assert len(result.valid_items) == 2
        assert len(result.invalid_items) == 2


class TestHostValidator:
    """Host 검증기 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.validator = HostValidator(enable_dns_check=False)
    
    def test_valid_host_formats(self):
        """유효한 Host 형식 테스트"""
        valid_hosts = [
            "192.168.1.1",
            "10.251.196.122",
            "::1",
            "host01",
            "example.com",
            "server-01"
        ]
        
        for host in valid_hosts:
            is_valid, error = self.validator.validate_format(host)
            assert is_valid, f"'{host}'는 유효해야 합니다: {error}"
    
    def test_invalid_host_formats(self):
        """무효한 Host 형식 테스트"""
        invalid_hosts = [
            "",
            "256.256.256.256",  # 잘못된 IP
            "invalid@host",
            "host..name",
            "-invalid"
        ]
        
        for host in invalid_hosts:
            is_valid, error = self.validator.validate_format(host)
            assert not is_valid, f"'{host}'는 무효해야 합니다"
            assert error, "오류 메시지가 있어야 합니다"
    
    def test_multiple_host_validation(self):
        """다중 Host 검증 테스트"""
        hosts = ["192.168.1.1", "host01", "invalid@host", "256.256.256.256"]
        result = self.validator.validate_multiple(hosts)
        
        assert isinstance(result, ValidationResult)
        assert not result.is_valid
        assert len(result.valid_items) == 2
        assert len(result.invalid_items) == 2


class TestUtilityFunctions:
    """유틸리티 함수 테스트"""
    
    def test_to_list_function(self):
        """to_list 함수 테스트"""
        # None 입력
        assert to_list(None) == []
        
        # 문자열 입력
        assert to_list("a,b,c") == ["a", "b", "c"]
        assert to_list("a, b , c ") == ["a", "b", "c"]  # 공백 제거
        assert to_list("single") == ["single"]
        assert to_list("") == []
        
        # 리스트 입력
        assert to_list(["a", "b", "c"]) == ["a", "b", "c"]
        assert to_list([1, 2, 3]) == ["1", "2", "3"]  # 문자열 변환
        assert to_list([]) == []
        
        # 기타 타입
        assert to_list(123) == ["123"]
        assert to_list(0) == ["0"]


class TestIntegratedValidation:
    """통합 검증 테스트"""
    
    @patch('kpi_dashboard.backend.app.utils.target_validation.psycopg2')
    def test_validate_ne_cell_host_filters_success(self, mock_psycopg2):
        """성공적인 통합 검증 테스트"""
        # Mock 데이터베이스 연결
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchone.return_value = [1]  # 존재함을 의미
        
        request = {
            "ne": "nvgnb#10000",
            "cellid": "2010",
            "host": "192.168.1.1"
        }
        
        # 예외가 발생하지 않으면 성공
        try:
            target_filters, validation_results = validate_ne_cell_host_filters(
                request, db_connection=mock_conn
            )
            
            assert target_filters.ne_filters == ["nvgnb#10000"]
            assert target_filters.cellid_filters == ["2010"]
            assert target_filters.host_filters == ["192.168.1.1"]
            assert len(validation_results) == 3  # ne, cell, host
            
        except Exception as e:
            pytest.fail(f"검증이 성공해야 하는데 실패했습니다: {e}")
    
    def test_validate_ne_cell_host_filters_no_db(self):
        """DB 연결 없이 검증 테스트"""
        request = {
            "ne": "nvgnb#10000",
            "cellid": "2010",
            "host": "192.168.1.1"
        }
        
        # DB 연결 없이도 형식 검증은 성공해야 함
        target_filters, validation_results = validate_ne_cell_host_filters(request)
        
        assert target_filters.ne_filters == ["nvgnb#10000"]
        assert target_filters.cellid_filters == ["2010"]
        assert target_filters.host_filters == ["192.168.1.1"]
        assert len(validation_results) == 3
    
    def test_validate_ne_cell_host_filters_invalid_input(self):
        """무효한 입력에 대한 검증 테스트"""
        request = {
            "ne": "invalid_ne",
            "cellid": "invalid_cell",
            "host": "invalid@host"
        }
        
        # 검증 실패로 예외가 발생해야 함
        with pytest.raises(Exception):  # HostValidationException 또는 TargetValidationException
            validate_ne_cell_host_filters(request)


class TestAnalysisLLMIntegration:
    """analysis_llm.py 통합 테스트"""
    
    def test_enhanced_to_list_compatibility(self):
        """향상된 to_list 함수가 기존과 호환되는지 테스트"""
        # 기존 analysis_llm.py의 to_list와 동일한 동작 확인
        
        test_cases = [
            (None, []),
            ("", []),
            ("a", ["a"]),
            ("a,b,c", ["a", "b", "c"]),
            (" a , b , c ", ["a", "b", "c"]),
            (["a", "b", "c"], ["a", "b", "c"]),
            ([1, 2, 3], ["1", "2", "3"]),
            (123, ["123"])
        ]
        
        for input_val, expected in test_cases:
            result = to_list(input_val)
            assert result == expected, f"입력 {input_val}에 대해 {expected}를 기대했지만 {result}를 받았습니다"


if __name__ == "__main__":
    # 직접 실행 시 기본 테스트 수행
    import sys
    
    if not VALIDATION_MODULE_AVAILABLE:
        print("❌ 검증 모듈을 로드할 수 없어 테스트를 건너뜁니다.")
        sys.exit(1)
    
    print("🧪 타겟 검증 통합 테스트 시작")
    
    # 기본 검증기 테스트
    print("\n1. NE ID 검증기 테스트")
    ne_validator = NEIDValidator()
    assert ne_validator.validate_format("nvgnb#10000")[0], "NE ID 검증 실패"
    assert not ne_validator.validate_format("invalid")[0], "잘못된 NE ID가 통과됨"
    print("✅ NE ID 검증기 통과")
    
    print("\n2. Cell ID 검증기 테스트")
    cell_validator = CellIDValidator()
    assert cell_validator.validate_format("2010")[0], "Cell ID 검증 실패"
    assert not cell_validator.validate_format("invalid")[0], "잘못된 Cell ID가 통과됨"
    print("✅ Cell ID 검증기 통과")
    
    print("\n3. Host 검증기 테스트")
    host_validator = HostValidator()
    assert host_validator.validate_format("192.168.1.1")[0], "Host 검증 실패"
    assert not host_validator.validate_format("invalid@host")[0], "잘못된 Host가 통과됨"
    print("✅ Host 검증기 통과")
    
    print("\n4. 유틸리티 함수 테스트")
    assert to_list("a,b,c") == ["a", "b", "c"], "to_list 함수 오류"
    assert to_list(None) == [], "to_list None 처리 오류"
    print("✅ 유틸리티 함수 통과")
    
    print("\n🎉 모든 기본 테스트 통과!")
    print("\n상세한 테스트를 실행하려면: pytest tests/test_target_validation_integration.py -v")
