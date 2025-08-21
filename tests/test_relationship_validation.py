"""
NE-Cell-Host 관계 검증 테스트

강화된 관계 검증 시스템의 포괄적인 테스트를 수행합니다.
"""

import pytest
import logging
from unittest.mock import Mock, patch, MagicMock
from dataclasses import dataclass

# 로깅 설정
logging.basicConfig(level=logging.INFO)

# 테스트 대상 모듈 임포트
try:
    from kpi_dashboard.backend.app.utils.relationship_validator import (
        NetworkRelationshipValidator,
        RelationshipMapping,
        CoverageAnalysis,
        get_relationship_validation_summary
    )
    from kpi_dashboard.backend.app.utils.target_validation import validate_ne_cell_host_filters
    VALIDATION_MODULE_AVAILABLE = True
except ImportError as e:
    VALIDATION_MODULE_AVAILABLE = False
    pytest.skip(f"관계 검증 모듈을 로드할 수 없습니다: {e}", allow_module_level=True)


class TestNetworkRelationshipValidator:
    """네트워크 관계 검증기 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.mock_conn = Mock()
        self.validator = NetworkRelationshipValidator(self.mock_conn, "test_table")
    
    def test_validator_initialization(self):
        """검증기 초기화 테스트"""
        assert self.validator.db_connection == self.mock_conn
        assert self.validator.table == "test_table"
    
    @patch('kpi_dashboard.backend.app.utils.relationship_validator.psycopg2')
    def test_get_existing_relationships_success(self, mock_psycopg2):
        """기존 관계 조회 성공 테스트"""
        # Mock 데이터베이스 응답
        mock_cursor = Mock()
        self.mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchall.return_value = [
            {"ne": "nvgnb#10000", "cellid": "2010", "host": "192.168.1.1"},
            {"ne": "nvgnb#10000", "cellid": "2011", "host": "192.168.1.1"},
            {"ne": "nvgnb#20000", "cellid": "8418", "host": "host01"}
        ]
        
        # 테스트 실행
        mapping = self.validator._get_existing_relationships(
            ["nvgnb#10000"], ["2010", "2011"], ["192.168.1.1"],
            "ne", "cellid", "host"
        )
        
        # 검증
        assert isinstance(mapping, RelationshipMapping)
        assert len(mapping.ne_cell_pairs) > 0
        assert len(mapping.valid_combinations) > 0
        assert ("nvgnb#10000", "2010") in mapping.ne_cell_pairs
    
    def test_get_existing_relationships_empty_filters(self):
        """빈 필터에 대한 관계 조회 테스트"""
        mapping = self.validator._get_existing_relationships(
            [], [], [], "ne", "cellid", "host"
        )
        
        assert isinstance(mapping, RelationshipMapping)
        assert len(mapping.ne_cell_pairs) == 0
        assert len(mapping.valid_combinations) == 0
    
    @patch('kpi_dashboard.backend.app.utils.relationship_validator.psycopg2')
    def test_validate_comprehensive_relationships_success(self, mock_psycopg2):
        """포괄적인 관계 검증 성공 테스트"""
        # Mock 데이터베이스 응답
        mock_cursor = Mock()
        self.mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.fetchall.return_value = [
            {"ne": "nvgnb#10000", "cellid": "2010", "host": "192.168.1.1"}
        ]
        
        # 테스트 실행
        mapping, analysis = self.validator.validate_comprehensive_relationships(
            ["nvgnb#10000"], ["2010"], ["192.168.1.1"]
        )
        
        # 검증
        assert isinstance(mapping, RelationshipMapping)
        assert isinstance(analysis, CoverageAnalysis)
        assert analysis.coverage_ratio > 0.0
    
    def test_validate_ne_cell_relationships(self):
        """NE-Cell 관계 검증 테스트"""
        ne_cell_pairs = [("nvgnb#10000", "2010"), ("nvgnb#20000", "8418")]
        
        # 유효한 조합
        invalid_pairs = self.validator._validate_ne_cell_relationships(
            ["nvgnb#10000"], ["2010"], ne_cell_pairs
        )
        assert len(invalid_pairs) == 0
        
        # 무효한 조합
        invalid_pairs = self.validator._validate_ne_cell_relationships(
            ["nvgnb#10000"], ["9999"], ne_cell_pairs  # 존재하지 않는 Cell
        )
        assert len(invalid_pairs) == 1
        assert ("nvgnb#10000", "9999") in invalid_pairs
    
    def test_analyze_coverage(self):
        """커버리지 분석 테스트"""
        # Mock 관계 매핑
        mapping = RelationshipMapping(
            ne_cell_pairs=[("nvgnb#10000", "2010")],
            cell_host_pairs=[("2010", "192.168.1.1")],
            ne_host_pairs=[("nvgnb#10000", "192.168.1.1")],
            valid_combinations=[
                {"ne": "nvgnb#10000", "cell": "2010", "host": "192.168.1.1"}
            ],
            orphaned_targets={}
        )
        
        # 커버리지 분석
        analysis = self.validator._analyze_coverage(
            ["nvgnb#10000"], ["2010"], ["192.168.1.1"], mapping
        )
        
        assert isinstance(analysis, CoverageAnalysis)
        assert analysis.total_possible_combinations == 1
        assert analysis.valid_combinations == 1
        assert analysis.coverage_ratio == 1.0
    
    def test_find_orphaned_targets(self):
        """고아 타겟 찾기 테스트"""
        ne_cell_pairs = {("nvgnb#10000", "2010")}
        cell_host_pairs = {("2010", "192.168.1.1")}
        ne_host_pairs = {("nvgnb#10000", "192.168.1.1")}
        
        # 연결되지 않은 타겟이 있는 경우
        orphaned = self.validator._find_orphaned_targets(
            ["nvgnb#10000", "nvgnb#99999"],  # nvgnb#99999는 연결되지 않음
            ["2010"], ["192.168.1.1"],
            ne_cell_pairs, cell_host_pairs, ne_host_pairs
        )
        
        assert "ne" in orphaned
        assert "nvgnb#99999" in orphaned["ne"]
    
    def test_generate_optimization_suggestions(self):
        """최적화 제안 생성 테스트"""
        suggestions = self.validator._generate_optimization_suggestions(
            coverage_ratio=0.3,  # 낮은 커버리지
            missing_relationships=[{"ne": "test", "cell": "test", "host": "test"}] * 15,  # 많은 누락
            redundant_filters=["중복 필터 있음"]
        )
        
        assert len(suggestions) > 0
        assert any("커버리지가 낮습니다" in s for s in suggestions)
        assert any("누락된 관계가 많습니다" in s for s in suggestions)
        assert any("중복 필터를 제거" in s for s in suggestions)


class TestRelationshipDataStructures:
    """관계 데이터 구조 테스트"""
    
    def test_relationship_mapping_creation(self):
        """RelationshipMapping 생성 테스트"""
        mapping = RelationshipMapping(
            ne_cell_pairs=[("ne1", "cell1")],
            cell_host_pairs=[("cell1", "host1")],
            ne_host_pairs=[("ne1", "host1")],
            valid_combinations=[{"ne": "ne1", "cell": "cell1", "host": "host1"}],
            orphaned_targets={"ne": ["orphan_ne"]}
        )
        
        assert len(mapping.ne_cell_pairs) == 1
        assert len(mapping.valid_combinations) == 1
        assert "ne" in mapping.orphaned_targets
    
    def test_coverage_analysis_creation(self):
        """CoverageAnalysis 생성 테스트"""
        analysis = CoverageAnalysis(
            total_possible_combinations=10,
            valid_combinations=8,
            coverage_ratio=0.8,
            missing_relationships=[],
            redundant_filters=[],
            optimization_suggestions=["테스트 제안"]
        )
        
        assert analysis.total_possible_combinations == 10
        assert analysis.valid_combinations == 8
        assert analysis.coverage_ratio == 0.8


class TestIntegratedValidation:
    """통합 검증 테스트"""
    
    @patch('kpi_dashboard.backend.app.utils.target_validation.psycopg2')
    @patch('kpi_dashboard.backend.app.utils.relationship_validator.psycopg2')
    def test_validate_ne_cell_host_filters_with_relationships(self, mock_rel_psycopg2, mock_val_psycopg2):
        """관계 검증이 포함된 통합 검증 테스트"""
        # Mock 데이터베이스 연결
        mock_conn = Mock()
        
        # Mock 각 검증기의 데이터베이스 응답
        mock_cursor = Mock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        
        # 존재 여부 확인용 Mock (각 검증기)
        mock_cursor.fetchone.return_value = [1]  # 항목 존재
        
        # 관계 검증용 Mock
        mock_cursor.fetchall.return_value = [
            {"ne": "nvgnb#10000", "cellid": "2010", "host": "192.168.1.1"}
        ]
        
        request = {
            "ne": "nvgnb#10000",
            "cellid": "2010", 
            "host": "192.168.1.1"
        }
        
        db_params = {
            "table": "summary",
            "ne_column": "ne",
            "cell_column": "cellid",
            "host_column": "host"
        }
        
        # 테스트 실행
        target_filters, validation_results = validate_ne_cell_host_filters(
            request, db_connection=mock_conn, **db_params
        )
        
        # 검증
        assert target_filters.ne_filters == ["nvgnb#10000"]
        assert target_filters.cellid_filters == ["2010"]
        assert target_filters.host_filters == ["192.168.1.1"]
        
        # 관계 검증 결과 확인
        assert "relationships" in validation_results
        relationships_result = validation_results["relationships"]
        assert relationships_result.is_valid
        assert "relationship_summary" in relationships_result.metadata


class TestEdgeCases:
    """엣지 케이스 테스트"""
    
    def setup_method(self):
        """각 테스트 전에 실행"""
        self.mock_conn = Mock()
        self.validator = NetworkRelationshipValidator(self.mock_conn)
    
    def test_large_filter_combination(self):
        """대량 필터 조합 테스트"""
        # 많은 필터 생성
        large_ne_filters = [f"nvgnb#{i:05d}" for i in range(10)]
        large_cell_filters = [str(i) for i in range(2000, 2020)]
        large_host_filters = [f"192.168.1.{i}" for i in range(1, 11)]
        
        # 조합 검증 테스트 (예외가 발생하지 않아야 함)
        from kpi_dashboard.backend.app.utils.target_validation import _validate_filter_combinations
        
        # 이 조합은 10 * 20 * 10 = 2000개이므로 임계값(1000)을 초과
        with pytest.raises(Exception):  # FilterCombinationException 예상
            _validate_filter_combinations(large_ne_filters, large_cell_filters, large_host_filters)
    
    @patch('kpi_dashboard.backend.app.utils.relationship_validator.psycopg2')
    def test_database_error_handling(self, mock_psycopg2):
        """데이터베이스 오류 처리 테스트"""
        # 데이터베이스 오류 시뮬레이션
        mock_cursor = Mock()
        self.mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_cursor.execute.side_effect = Exception("DB 연결 오류")
        
        # 예외가 적절히 처리되는지 확인
        with pytest.raises(Exception):  # RelationshipValidationException 예상
            self.validator._get_existing_relationships(
                ["nvgnb#10000"], ["2010"], ["192.168.1.1"],
                "ne", "cellid", "host"
            )
    
    def test_empty_result_handling(self):
        """빈 결과 처리 테스트"""
        # 빈 관계 매핑으로 커버리지 분석
        empty_mapping = RelationshipMapping([], [], [], [], {})
        
        analysis = self.validator._analyze_coverage(
            ["nvgnb#10000"], ["2010"], ["192.168.1.1"], empty_mapping
        )
        
        assert analysis.coverage_ratio == 0.0
        assert analysis.valid_combinations == 0


class TestValidationSummary:
    """검증 요약 테스트"""
    
    def test_get_relationship_validation_summary(self):
        """관계 검증 요약 테스트"""
        # Mock 데이터 생성
        mapping = RelationshipMapping(
            ne_cell_pairs=[("ne1", "cell1"), ("ne2", "cell2")],
            cell_host_pairs=[("cell1", "host1")],
            ne_host_pairs=[("ne1", "host1")],
            valid_combinations=[{"ne": "ne1", "cell": "cell1", "host": "host1"}],
            orphaned_targets={"ne": ["orphan_ne"]}
        )
        
        analysis = CoverageAnalysis(
            total_possible_combinations=5,
            valid_combinations=1,
            coverage_ratio=0.2,
            missing_relationships=[],
            redundant_filters=[],
            optimization_suggestions=["제안1", "제안2"]
        )
        
        # 요약 생성
        summary = get_relationship_validation_summary(mapping, analysis)
        
        # 검증
        assert "relationship_summary" in summary
        assert "coverage_summary" in summary
        assert "validation_status" in summary
        
        assert summary["relationship_summary"]["ne_cell_relationships"] == 2
        assert summary["coverage_summary"]["coverage_ratio"] == 0.2
        assert summary["validation_status"]["coverage_level"] == "low"


if __name__ == "__main__":
    # 직접 실행 시 기본 테스트 수행
    import sys
    
    if not VALIDATION_MODULE_AVAILABLE:
        print("❌ 관계 검증 모듈을 로드할 수 없어 테스트를 건너뜁니다.")
        sys.exit(1)
    
    print("🧪 관계 검증 테스트 시작")
    
    # 기본 데이터 구조 테스트
    print("\n1. 데이터 구조 테스트")
    mapping = RelationshipMapping([], [], [], [], {})
    analysis = CoverageAnalysis(0, 0, 0.0, [], [], [])
    print("✅ 데이터 구조 생성 성공")
    
    # 요약 함수 테스트
    print("\n2. 요약 함수 테스트")
    summary = get_relationship_validation_summary(mapping, analysis)
    assert "relationship_summary" in summary
    assert "coverage_summary" in summary
    print("✅ 요약 함수 성공")
    
    print("\n🎉 모든 기본 테스트 통과!")
    print("\n상세한 테스트를 실행하려면: pytest tests/test_relationship_validation.py -v")
