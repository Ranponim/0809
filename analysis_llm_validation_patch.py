"""
analysis_llm.py 검증 로직 개선 패치

기존 analysis_llm.py의 필터 처리 부분에 새로운 검증 유틸리티를 통합하는 패치입니다.
이 패치는 기존 코드의 1460-1477 라인을 대체합니다.
"""

import logging
from typing import Dict, Any, List, Optional

# 새로운 검증 유틸리티 임포트
try:
    from kpi_dashboard.backend.app.utils.target_validation import (
        validate_ne_cell_host_filters,
        to_list,
        TargetFilters
    )
    VALIDATION_AVAILABLE = True
except ImportError:
    # 검증 유틸리티를 사용할 수 없는 경우 기존 로직으로 폴백
    VALIDATION_AVAILABLE = False
    logging.warning("새로운 검증 유틸리티를 로드할 수 없습니다. 기존 로직을 사용합니다.")

logger = logging.getLogger(__name__)


def enhanced_filter_processing(request: Dict[str, Any], conn, table: str, columns: Dict[str, str]) -> tuple:
    """
    개선된 필터 처리 로직
    
    기존 analysis_llm.py의 1460-1477 라인을 대체하는 함수입니다.
    새로운 검증 유틸리티를 사용하여 강화된 검증을 수행합니다.
    
    Args:
        request: 요청 딕셔너리
        conn: 데이터베이스 연결
        table: 테이블명
        columns: 컬럼 매핑
        
    Returns:
        tuple: (ne_filters, cellid_filters, host_filters, validation_metadata)
    """
    logger.info("개선된 필터 처리 시작")
    
    if VALIDATION_AVAILABLE:
        # 새로운 검증 로직 사용
        try:
            db_params = {
                'table': table,
                'ne_column': columns.get('ne', 'ne'),
                'cell_column': columns.get('cell') or columns.get('cellid', 'cellid'),
                'host_column': columns.get('host', 'host')
            }
            
            # 통합 검증 수행
            target_filters, validation_results = validate_ne_cell_host_filters(
                request, 
                db_connection=conn,
                enable_dns_check=False,  # 성능상 DNS 체크는 비활성화
                **db_params
            )
            
            # 검증된 필터 추출
            ne_filters = target_filters.ne_filters or []
            cellid_filters = target_filters.cellid_filters or []
            host_filters = target_filters.host_filters or []
            
            # 검증 메타데이터 생성
            validation_metadata = {
                "validation_enabled": True,
                "validation_results": {
                    target_type: {
                        "valid_count": len(result.valid_items),
                        "invalid_count": len(result.invalid_items),
                        "total_count": result.metadata.get("total_count", 0)
                    }
                    for target_type, result in validation_results.items()
                },
                "target_summary": {
                    "ne_count": len(ne_filters),
                    "cell_count": len(cellid_filters),
                    "host_count": len(host_filters)
                }
            }
            
            logger.info(
                "새로운 검증 로직 적용 완료 - NE: %d, Cell: %d, Host: %d",
                len(ne_filters), len(cellid_filters), len(host_filters)
            )
            
            return ne_filters, cellid_filters, host_filters, validation_metadata
            
        except Exception as e:
            logger.error(f"새로운 검증 로직 실행 실패: {e}")
            logger.info("기존 로직으로 폴백합니다")
            # 폴백: 기존 로직 사용
            return _legacy_filter_processing(request)
    
    else:
        # 기존 로직 사용
        return _legacy_filter_processing(request)


def _legacy_filter_processing(request: Dict[str, Any]) -> tuple:
    """
    기존 필터 처리 로직 (폴백용)
    
    기존 analysis_llm.py의 로직을 그대로 재현합니다.
    """
    logger.info("기존 필터 처리 로직 사용")
    
    # 기존 to_list 함수 재현
    def to_list(raw):
        if raw is None:
            return []
        if isinstance(raw, str):
            return [t.strip() for t in raw.split(',') if t.strip()]
        if isinstance(raw, list):
            return [str(t).strip() for t in raw if str(t).strip()]
        return [str(raw).strip()]
    
    # 선택적 입력 필터 수집: ne, cellid
    ne_raw = request.get('ne')
    cell_raw = request.get('cellid') or request.get('cell')
    host_raw = request.get('host')  # 새로 추가
    
    ne_filters = to_list(ne_raw)
    cellid_filters = to_list(cell_raw)
    host_filters = to_list(host_raw)  # 새로 추가
    
    validation_metadata = {
        "validation_enabled": False,
        "target_summary": {
            "ne_count": len(ne_filters),
            "cell_count": len(cellid_filters),
            "host_count": len(host_filters)
        }
    }
    
    logger.info("기존 필터 처리 완료 - NE: %d, Cell: %d, Host: %d", 
                len(ne_filters), len(cellid_filters), len(host_filters))
    
    return ne_filters, cellid_filters, host_filters, validation_metadata


def apply_validation_patch_to_analysis_function():
    """
    analysis_llm.py의 _analyze_cell_performance_logic 함수에 패치를 적용하는 방법을 안내합니다.
    
    기존 코드의 1460-1477 라인을:
    
    ```python
    # 선택적 입력 필터 수집: ne, cellid
    # request 예시: { "ne": "nvgnb#10000" } 또는 { "ne": ["nvgnb#10000","nvgnb#20000"], "cellid": "2010,2011" }
    ne_raw = request.get('ne')
    cell_raw = request.get('cellid') or request.get('cell')

    def to_list(raw):
        if raw is None:
            return []
        if isinstance(raw, str):
            return [t.strip() for t in raw.split(',') if t.strip()]
        if isinstance(raw, list):
            return [str(t).strip() for t in raw if str(t).strip()]
        return [str(raw).strip()]

    ne_filters = to_list(ne_raw)
    cellid_filters = to_list(cell_raw)

    logging.info("입력 필터: ne=%s, cellid=%s", ne_filters, cellid_filters)
    ```
    
    다음으로 대체하세요:
    
    ```python
    # 개선된 필터 처리 (검증 유틸리티 통합)
    from analysis_llm_validation_patch import enhanced_filter_processing
    
    ne_filters, cellid_filters, host_filters, validation_metadata = enhanced_filter_processing(
        request, conn, table, columns
    )
    
    logging.info("입력 필터: ne=%s, cellid=%s, host=%s", ne_filters, cellid_filters, host_filters)
    logging.info("검증 메타데이터: %s", validation_metadata)
    ```
    
    그리고 fetch_cell_averages_for_period 호출 부분도 host_filters를 포함하도록 수정해야 합니다.
    """
    pass


def get_enhanced_fetch_cell_averages_signature():
    """
    fetch_cell_averages_for_period 함수 시그니처 확장 제안
    
    기존:
    fetch_cell_averages_for_period(conn, table, columns, start_dt, end_dt, period_label, 
                                   ne_filters=None, cellid_filters=None)
    
    확장:
    fetch_cell_averages_for_period(conn, table, columns, start_dt, end_dt, period_label,
                                   ne_filters=None, cellid_filters=None, host_filters=None)
    """
    return """
    def fetch_cell_averages_for_period(
        conn,
        table: str,
        columns: Dict[str, str],
        start_dt: datetime.datetime,
        end_dt: datetime.datetime,
        period_label: str,
        ne_filters: Optional[list] = None,
        cellid_filters: Optional[list] = None,
        host_filters: Optional[list] = None,  # 새로 추가
    ) -> pd.DataFrame:
        # ... 기존 코드 ...
        
        # Host 필터 추가 (line 466 이후에 추가)
        if host_filters:
            host_col = columns.get("host", "host")
            host_vals = [str(x).strip() for x in (host_filters or []) if str(x).strip()]
            if len(host_vals) == 1:
                sql += f" AND {host_col} = %s"
                params.append(host_vals[0])
            elif len(host_vals) > 1:
                placeholders = ",".join(["%s"] * len(host_vals))
                sql += f" AND {host_col} IN ({placeholders})"
                params.extend(host_vals)
        
        # ... 나머지 기존 코드 ...
    """


if __name__ == "__main__":
    # 패치 적용 가이드 출력
    print("=== analysis_llm.py 검증 로직 개선 패치 ===")
    print()
    print("1. 이 패치는 기존 analysis_llm.py의 필터 처리 로직을 개선합니다.")
    print("2. 새로운 검증 유틸리티를 통합하여 강화된 NE/Cell/Host 검증을 제공합니다.")
    print("3. 기존 코드와의 호환성을 위해 폴백 메커니즘을 포함합니다.")
    print()
    print("적용 방법:")
    print("- enhanced_filter_processing 함수를 사용하여 기존 필터 처리 로직을 대체")
    print("- fetch_cell_averages_for_period 함수에 host_filters 파라미터 추가")
    print("- 검증 메타데이터를 결과 payload에 포함")
    print()
    print("주요 개선사항:")
    print("- NE ID 형식 검증 (정규식 기반)")
    print("- Cell ID 범위 검증")  
    print("- Host ID 형식 검증 (IP/도메인/호스트명)")
    print("- 데이터베이스 존재 여부 확인")
    print("- 타겟 간 관계 검증")
    print("- 상세한 오류 메시지")
    print("- 검증 결과 메타데이터 제공")
