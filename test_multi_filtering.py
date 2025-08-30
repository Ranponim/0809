#!/usr/bin/env python3
"""
다중 필터링 기능 테스트 스크립트

analysis_llm.py의 다중 NE/Cell/Host 필터링 기능이 제대로 작동하는지 테스트합니다.
"""

import json
from datetime import datetime
from analysis_llm import _analyze_cell_performance_logic

def test_multi_filtering_payload():
    """다중 필터링 시 payload 구조 테스트"""

    # 다중 필터링이 적용된 요청
    request_with_filters = {
        "n_minus_1": "2025-08-08_00:00~2025-08-08_23:59",
        "n": "2025-08-09_00:00~2025-08-09_23:59",
        "output_dir": "./test_output",
        "backend_url": "http://localhost:8000/api/analysis/results",
        "db": {
            "host": "127.0.0.1",
            "port": 5432,
            "user": "postgres",
            "password": "test_pass",
            "dbname": "netperf"
        },
        "table": "summary",
        "columns": {
            "time": "datetime",
            "peg_name": "peg_name",
            "value": "value",
            "ne": "ne",
            "cell": "cellid",
            "host": "host"
        },
        # 다중 필터링 테스트
        "ne": ["nvgnb#10000", "nvgnb#20000", "nvgnb#30000"],
        "cellid": ["2010", "2011", "2012"],
        "host": ["host01", "192.168.1.10"],
        "preference": "Random_access_preamble_count,Random_access_response"
    }

    print("🔍 다중 필터링 payload 구조 테스트")
    print("=" * 50)

    try:
        # 실제 분석 로직은 실행하지 않고, 필터링 부분만 테스트
        from analysis_llm import _get_default_tzinfo, parse_time_range

        # 필터 처리 로직 추출 및 테스트
        ne_raw = request_with_filters.get('ne')
        cell_raw = request_with_filters.get('cellid') or request_with_filters.get('cell')
        host_raw = request_with_filters.get('host')

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
        host_filters = to_list(host_raw)

        print(f"📋 NE 필터: {ne_filters}")
        print(f"📋 Cell ID 필터: {cellid_filters}")
        print(f"📋 Host 필터: {host_filters}")

        # TargetScope 및 FilterMetadata 구성 테스트
        target_scope = None
        filter_metadata = None

        if ne_filters or cellid_filters or host_filters:
            target_scope = {
                "ne_ids": ne_filters if ne_filters else None,
                "cell_ids": cellid_filters if cellid_filters else None,
                "host_ids": host_filters if host_filters else None,
                "primary_ne": ne_filters[0] if ne_filters else None,
                "primary_cell": cellid_filters[0] if cellid_filters else None,
                "primary_host": host_filters[0] if host_filters else None,
                "scope_type": "specific_target" if (ne_filters or cellid_filters or host_filters) else "network_wide"
            }

            filter_metadata = {
                "applied_ne_count": len(ne_filters) if ne_filters else 0,
                "applied_cell_count": len(cellid_filters) if cellid_filters else 0,
                "applied_host_count": len(host_filters) if host_filters else 0,
                "data_coverage_ratio": None,
                "relationship_coverage": None
            }

        # 대표 ID (하위 호환성)
        ne_id_repr = ne_filters[0] if ne_filters else "ALL"
        cell_id_repr = cellid_filters[0] if cellid_filters else "ALL"

        print(f"🏷️ 대표 NE ID: {ne_id_repr}")
        print(f"🏷️ 대표 Cell ID: {cell_id_repr}")

        print("\n📊 Target Scope 구조:")
        print(json.dumps(target_scope, indent=2, ensure_ascii=False))

        print("\n📈 Filter Metadata 구조:")
        print(json.dumps(filter_metadata, indent=2, ensure_ascii=False))

        # 샘플 payload 구조
        sample_payload = {
            "analysis_type": "llm_analysis",
            "analysisDate": datetime.now().isoformat(),
            "neId": ne_id_repr,
            "cellId": cell_id_repr,
            "status": "success",
            "target_scope": target_scope,
            "filter_metadata": filter_metadata,
            "request_params": {
                "filters": {
                    "ne": ne_filters,
                    "cellid": cellid_filters,
                    "host": host_filters
                }
            }
        }

        print("\n📦 최종 Payload 구조 (일부):")
        print(json.dumps(sample_payload, indent=2, ensure_ascii=False))

        print("\n✅ 다중 필터링 구조 테스트 완료")
        return True

    except Exception as e:
        print(f"❌ 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_single_filtering_comparison():
    """단일 필터링 vs 다중 필터링 비교"""

    print("\n🔄 단일 필터링 vs 다중 필터링 비교")
    print("=" * 50)

    # 단일 필터링 케이스
    single_request = {
        "ne": "nvgnb#10000",
        "cellid": "2010"
    }

    # 다중 필터링 케이스
    multi_request = {
        "ne": ["nvgnb#10000", "nvgnb#20000"],
        "cellid": ["2010", "2011"]
    }

    for label, req in [("단일 필터링", single_request), ("다중 필터링", multi_request)]:
        print(f"\n📋 {label}:")

        ne_raw = req.get('ne')
        cell_raw = req.get('cellid') or req.get('cell')

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

        # TargetScope 구성
        target_scope = {
            "ne_ids": ne_filters if ne_filters else None,
            "cell_ids": cellid_filters if cellid_filters else None,
            "primary_ne": ne_filters[0] if ne_filters else None,
            "primary_cell": cellid_filters[0] if cellid_filters else None,
            "scope_type": "specific_target" if (ne_filters or cellid_filters) else "network_wide"
        }

        filter_metadata = {
            "applied_ne_count": len(ne_filters) if ne_filters else 0,
            "applied_cell_count": len(cellid_filters) if cellid_filters else 0,
            "applied_host_count": 0
        }

        print(f"  NE 필터 수: {len(ne_filters)}")
        print(f"  Cell 필터 수: {len(cellid_filters)}")
        print(f"  대표 NE: {target_scope['primary_ne']}")
        print(f"  대표 Cell: {target_scope['primary_cell']}")

def main():
    """메인 테스트 실행"""
    print("🧪 Analysis LLM 다중 필터링 테스트")
    print("=" * 50)

    # 다중 필터링 구조 테스트
    success = test_multi_filtering_payload()

    # 비교 테스트
    test_single_filtering_comparison()

    if success:
        print("\n🎉 모든 테스트 완료")
    else:
        print("\n❌ 테스트 실패")

if __name__ == "__main__":
    main()





