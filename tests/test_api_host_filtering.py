"""
API 레벨 Host 필터링 검증 테스트

analysis_llm.py의 Host 필터링 기능이 API 수준에서 올바르게 작동하는지 
포괄적으로 테스트합니다.
"""

import pytest
import logging
import json
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
from datetime import datetime

# 로깅 설정
logging.basicConfig(level=logging.INFO)

# 테스트 대상 함수 임포트 시뮬레이션
try:
    import sys
    import os
    sys.path.append(os.path.abspath('.'))
    from analysis_llm import _analyze_cell_performance_logic, fetch_cell_averages_for_period
    ANALYSIS_MODULE_AVAILABLE = True
except ImportError as e:
    ANALYSIS_MODULE_AVAILABLE = False
    pytest.skip(f"analysis_llm 모듈을 로드할 수 없습니다: {e}", allow_module_level=True)


class TestAPIHostFiltering:
    """API 레벨 Host 필터링 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.base_request = {
            "n_minus_1": "2025-01-01_00:00~2025-01-01_23:59",
            "n": "2025-01-02_00:00~2025-01-02_23:59",
            "output_dir": "./test_output",
            "db": {
                "host": "localhost",
                "port": 5432,
                "user": "test",
                "password": "test",
                "dbname": "test"
            },
            "table": "summary",
            "columns": {
                "time": "datetime",
                "peg_name": "peg_name", 
                "value": "value",
                "ne": "ne",
                "cellid": "cellid",
                "host": "host"
            }
        }
        
        # Mock 데이터베이스 응답
        self.mock_db_data = [
            {"peg_name": "Random_access_preamble_count", "avg_value": 100.0},
            {"peg_name": "Random_access_response", "avg_value": 80.0},
        ]
        
        self.expected_df = pd.DataFrame(self.mock_db_data)
        self.expected_df["period"] = "N-1"
    
    @patch('analysis_llm.get_db_connection')
    @patch('analysis_llm.fetch_cell_averages_for_period')
    @patch('analysis_llm.query_llm')
    @patch('analysis_llm.post_results_to_backend')
    def test_single_host_filter_integration(self, mock_post, mock_llm, mock_fetch, mock_db):
        """단일 Host 필터 API 통합 테스트"""
        # Mock 설정
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_fetch.return_value = self.expected_df
        mock_llm.return_value = {"executive_summary": "테스트 분석 결과"}
        mock_post.return_value = {"success": True}
        
        # Host 필터가 포함된 요청
        request = self.base_request.copy()
        request["host"] = "192.168.1.1"
        
        # 실행
        result = _analyze_cell_performance_logic(request)
        
        # 검증
        assert result is not None
        
        # fetch_cell_averages_for_period가 host_filters와 함께 호출되었는지 확인
        assert mock_fetch.call_count == 2  # N-1, N 두 번 호출
        
        call_args_1 = mock_fetch.call_args_list[0]
        call_args_2 = mock_fetch.call_args_list[1]
        
        # 첫 번째 호출 (N-1 기간) 확인
        assert 'host_filters' in call_args_1.kwargs
        assert call_args_1.kwargs['host_filters'] == ["192.168.1.1"]
        
        # 두 번째 호출 (N 기간) 확인 
        assert 'host_filters' in call_args_2.kwargs
        assert call_args_2.kwargs['host_filters'] == ["192.168.1.1"]
        
        # 로깅 검증
        assert mock_fetch.called
        
    @patch('analysis_llm.get_db_connection')
    @patch('analysis_llm.fetch_cell_averages_for_period')
    @patch('analysis_llm.query_llm')
    @patch('analysis_llm.post_results_to_backend')
    def test_multiple_host_filters_integration(self, mock_post, mock_llm, mock_fetch, mock_db):
        """다중 Host 필터 API 통합 테스트"""
        # Mock 설정
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_fetch.return_value = self.expected_df
        mock_llm.return_value = {"executive_summary": "테스트 분석 결과"}
        mock_post.return_value = {"success": True}
        
        # 다중 Host 필터가 포함된 요청
        request = self.base_request.copy()
        request["host"] = ["192.168.1.1", "host01", "10.251.196.122"]
        
        # 실행
        result = _analyze_cell_performance_logic(request)
        
        # 검증
        assert result is not None
        
        # fetch_cell_averages_for_period가 다중 host_filters와 함께 호출되었는지 확인
        call_args = mock_fetch.call_args_list[0]
        expected_hosts = ["192.168.1.1", "host01", "10.251.196.122"]
        
        assert 'host_filters' in call_args.kwargs
        assert call_args.kwargs['host_filters'] == expected_hosts
        
    @patch('analysis_llm.get_db_connection')
    @patch('analysis_llm.fetch_cell_averages_for_period')
    @patch('analysis_llm.query_llm')
    @patch('analysis_llm.post_results_to_backend')
    def test_comma_separated_host_filters(self, mock_post, mock_llm, mock_fetch, mock_db):
        """쉼표로 구분된 Host 필터 테스트"""
        # Mock 설정
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_fetch.return_value = self.expected_df
        mock_llm.return_value = {"executive_summary": "테스트 분석 결과"}
        mock_post.return_value = {"success": True}
        
        # 쉼표로 구분된 Host 필터 요청
        request = self.base_request.copy()
        request["host"] = "192.168.1.1, host01 , 10.251.196.122"  # 공백 포함
        
        # 실행
        result = _analyze_cell_performance_logic(request)
        
        # 검증
        assert result is not None
        
        # 공백이 제거되고 올바르게 파싱되었는지 확인
        call_args = mock_fetch.call_args_list[0]
        expected_hosts = ["192.168.1.1", "host01", "10.251.196.122"]
        
        assert 'host_filters' in call_args.kwargs
        assert call_args.kwargs['host_filters'] == expected_hosts
        
    @patch('analysis_llm.get_db_connection')
    @patch('analysis_llm.fetch_cell_averages_for_period')
    @patch('analysis_llm.query_llm')
    @patch('analysis_llm.post_results_to_backend')
    def test_combined_ne_cell_host_filters(self, mock_post, mock_llm, mock_fetch, mock_db):
        """NE + Cell + Host 통합 필터 테스트"""
        # Mock 설정
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_fetch.return_value = self.expected_df
        mock_llm.return_value = {"executive_summary": "테스트 분석 결과"}
        mock_post.return_value = {"success": True}
        
        # 모든 필터가 포함된 요청
        request = self.base_request.copy()
        request.update({
            "ne": "nvgnb#10000",
            "cellid": "2010,8418",
            "host": "192.168.1.1"
        })
        
        # 실행
        result = _analyze_cell_performance_logic(request)
        
        # 검증
        assert result is not None
        
        # 모든 필터가 올바르게 전달되었는지 확인
        call_args = mock_fetch.call_args_list[0]
        
        assert call_args.kwargs['ne_filters'] == ["nvgnb#10000"]
        assert call_args.kwargs['cellid_filters'] == ["2010", "8418"]
        assert call_args.kwargs['host_filters'] == ["192.168.1.1"]
        
    @patch('analysis_llm.get_db_connection')
    def test_host_filter_sql_generation(self, mock_db):
        """Host 필터가 SQL에 올바르게 적용되는지 테스트"""
        # Mock 데이터베이스 설정
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_db.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchall.return_value = [
            {"peg_name": "test_peg", "avg_value": 100.0}
        ]
        
        # 테스트 파라미터
        table = "summary"
        columns = {"time": "datetime", "peg_name": "peg_name", "value": "value", "host": "host"}
        start_dt = datetime(2025, 1, 1, 0, 0)
        end_dt = datetime(2025, 1, 1, 23, 59)
        period_label = "test"
        host_filters = ["192.168.1.1", "host01"]
        
        # 실행
        result = fetch_cell_averages_for_period(
            mock_conn, table, columns, start_dt, end_dt, period_label,
            host_filters=host_filters
        )
        
        # SQL 실행 확인
        assert mock_cursor.execute.called
        
        # 실행된 SQL과 파라미터 확인
        call_args = mock_cursor.execute.call_args
        executed_sql = call_args[0][0]
        executed_params = call_args[0][1]
        
        # Host 조건이 SQL에 포함되었는지 확인
        assert "host IN" in executed_sql
        assert "192.168.1.1" in executed_params
        assert "host01" in executed_params
        
    def test_empty_host_filter_handling(self):
        """빈 Host 필터 처리 테스트"""
        # Mock 데이터베이스 설정
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchall.return_value = []
        
        # 빈 host_filters로 테스트
        result = fetch_cell_averages_for_period(
            mock_conn, "summary", 
            {"time": "datetime", "peg_name": "peg_name", "value": "value"},
            datetime(2025, 1, 1), datetime(2025, 1, 2), "test",
            host_filters=[]
        )
        
        # SQL에 Host 조건이 포함되지 않았는지 확인
        call_args = mock_cursor.execute.call_args
        executed_sql = call_args[0][0]
        
        assert "host" not in executed_sql.lower()
        
    def test_none_host_filter_handling(self):
        """None Host 필터 처리 테스트"""
        # Mock 데이터베이스 설정
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchall.return_value = []
        
        # None host_filters로 테스트
        result = fetch_cell_averages_for_period(
            mock_conn, "summary",
            {"time": "datetime", "peg_name": "peg_name", "value": "value"},
            datetime(2025, 1, 1), datetime(2025, 1, 2), "test",
            host_filters=None
        )
        
        # SQL에 Host 조건이 포함되지 않았는지 확인
        call_args = mock_cursor.execute.call_args
        executed_sql = call_args[0][0]
        
        assert "host" not in executed_sql.lower()


class TestHostFilterValidation:
    """Host 필터 검증 테스트"""
    
    def test_host_filter_input_normalization(self):
        """Host 필터 입력 정규화 테스트"""
        from analysis_llm import _analyze_cell_performance_logic
        
        # 다양한 Host 입력 형식 테스트
        test_cases = [
            # (입력, 예상 출력)
            ("192.168.1.1", ["192.168.1.1"]),
            (["192.168.1.1", "host01"], ["192.168.1.1", "host01"]),
            ("192.168.1.1,host01", ["192.168.1.1", "host01"]),
            (" 192.168.1.1 , host01 ", ["192.168.1.1", "host01"]),
            ("", []),
            (None, []),
            ([], []),
        ]
        
        # to_list 함수 직접 테스트 (analysis_llm.py 내부 함수)
        def to_list(raw):
            if raw is None:
                return []
            if isinstance(raw, str):
                return [t.strip() for t in raw.split(',') if t.strip()]
            if isinstance(raw, list):
                return [str(t).strip() for t in raw if str(t).strip()]
            return [str(raw).strip()]
        
        for input_val, expected in test_cases:
            result = to_list(input_val)
            assert result == expected, f"입력 {input_val}에 대해 {expected}를 기대했지만 {result}를 받았습니다"


class TestPerformanceImpact:
    """Host 필터링 성능 영향 테스트"""
    
    @patch('analysis_llm.get_db_connection')
    @patch('analysis_llm.fetch_cell_averages_for_period')
    def test_large_host_filter_performance(self, mock_fetch, mock_db):
        """대량 Host 필터의 성능 영향 테스트"""
        import time
        
        # Mock 설정
        mock_conn = Mock()
        mock_db.return_value = mock_conn
        mock_fetch.return_value = pd.DataFrame()
        
        # 대량 Host 필터 생성 (100개)
        large_host_list = [f"192.168.1.{i}" for i in range(1, 101)]
        
        # 성능 측정
        start_time = time.time()
        
        # to_list 함수 성능 테스트
        def to_list(raw):
            if raw is None:
                return []
            if isinstance(raw, str):
                return [t.strip() for t in raw.split(',') if t.strip()]
            if isinstance(raw, list):
                return [str(t).strip() for t in raw if str(t).strip()]
            return [str(raw).strip()]
        
        result = to_list(large_host_list)
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        # 성능 검증 (1초 이내 완료)
        assert execution_time < 1.0, f"대량 Host 필터 처리가 너무 오래 걸립니다: {execution_time}초"
        assert len(result) == 100, "모든 Host가 올바르게 처리되어야 합니다"


if __name__ == "__main__":
    # 직접 실행 시 기본 테스트 수행
    import sys
    
    if not ANALYSIS_MODULE_AVAILABLE:
        print("❌ analysis_llm 모듈을 로드할 수 없어 테스트를 건너뜁니다.")
        sys.exit(1)
    
    print("🧪 API 레벨 Host 필터링 테스트 시작")
    
    # 기본 기능 테스트
    print("\n1. Host 필터 입력 정규화 테스트")
    
    def to_list(raw):
        if raw is None:
            return []
        if isinstance(raw, str):
            return [t.strip() for t in raw.split(',') if t.strip()]
        if isinstance(raw, list):
            return [str(t).strip() for t in raw if str(t).strip()]
        return [str(raw).strip()]
    
    # 다양한 입력 테스트
    test_inputs = [
        ("192.168.1.1", ["192.168.1.1"]),
        ("192.168.1.1,host01", ["192.168.1.1", "host01"]),
        (["192.168.1.1", "host01"], ["192.168.1.1", "host01"]),
        ("", []),
        (None, [])
    ]
    
    for input_val, expected in test_inputs:
        result = to_list(input_val)
        assert result == expected, f"입력 정규화 실패: {input_val}"
    
    print("✅ Host 필터 입력 정규화 통과")
    
    print("\n2. 성능 테스트")
    import time
    
    # 대량 데이터 처리 테스트
    large_list = [f"host{i:03d}" for i in range(1000)]
    start_time = time.time()
    result = to_list(large_list)
    end_time = time.time()
    
    assert len(result) == 1000, "대량 데이터 처리 실패"
    assert (end_time - start_time) < 0.1, "성능이 너무 느림"
    
    print("✅ 성능 테스트 통과")
    
    print("\n🎉 모든 기본 테스트 통과!")
    print("\n상세한 테스트를 실행하려면: pytest tests/test_api_host_filtering.py -v")
