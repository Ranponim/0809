"""
analysis_llm.py Host 필터링 진단 정보 강화

Host 필터링이 적용된 경우, 분석 결과에 Host 관련 컨텍스트와 진단 정보를 추가합니다.
"""

import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


def create_host_diagnostic_context(
    host_filters: List[str],
    ne_filters: List[str],
    cellid_filters: List[str],
    n1_df_size: int,
    n_df_size: int
) -> Dict[str, Any]:
    """
    Host 필터링에 대한 진단 컨텍스트를 생성합니다.
    
    Args:
        host_filters: 적용된 Host 필터 목록
        ne_filters: 적용된 NE 필터 목록
        cellid_filters: 적용된 Cell 필터 목록
        n1_df_size: N-1 기간 데이터 크기
        n_df_size: N 기간 데이터 크기
        
    Returns:
        Dict[str, Any]: Host 진단 컨텍스트 정보
    """
    logger.info(f"Host 진단 컨텍스트 생성: {len(host_filters)}개 Host")
    
    # Host 타입 분석
    host_types = {
        "ip_addresses": [],
        "hostnames": [],
        "unknown": []
    }
    
    for host in host_filters:
        if _is_ip_address(host):
            host_types["ip_addresses"].append(host)
        elif _is_hostname(host):
            host_types["hostnames"].append(host)
        else:
            host_types["unknown"].append(host)
    
    # 필터 조합 분석
    filter_combination = _analyze_filter_combination(host_filters, ne_filters, cellid_filters)
    
    # 데이터 커버리지 분석
    data_coverage = _analyze_data_coverage(n1_df_size, n_df_size)
    
    context = {
        "host_filtering": {
            "enabled": True,
            "host_count": len(host_filters),
            "host_list": host_filters,
            "host_types": host_types,
            "primary_host": host_filters[0] if host_filters else None
        },
        "filter_combination": filter_combination,
        "data_coverage": data_coverage,
        "analysis_scope": {
            "scope_type": "host_specific" if host_filters else "network_wide",
            "target_description": _create_target_description(host_filters, ne_filters, cellid_filters)
        }
    }
    
    return context


def enhance_llm_prompt_with_host_context(
    base_prompt: str,
    host_diagnostic_context: Dict[str, Any]
) -> str:
    """
    기본 LLM 프롬프트에 Host 컨텍스트를 추가합니다.
    
    Args:
        base_prompt: 기본 프롬프트
        host_diagnostic_context: Host 진단 컨텍스트
        
    Returns:
        str: Host 정보가 강화된 프롬프트
    """
    if not host_diagnostic_context.get("host_filtering", {}).get("enabled"):
        return base_prompt
    
    host_info = host_diagnostic_context["host_filtering"]
    scope_info = host_diagnostic_context["analysis_scope"]
    
    # Host 컨텍스트 섹션 생성
    host_context_section = f"""

[Host 타겟 분석 컨텍스트]
이 분석은 특정 Host(들)에 대해 수행된 타겟 분석입니다:

• 분석 대상 Host: {', '.join(host_info['host_list'])}
• Host 수: {host_info['host_count']}개
• 주요 Host: {host_info['primary_host']}
• Host 타입 분포:
  - IP 주소: {len(host_info['host_types']['ip_addresses'])}개
  - 호스트명: {len(host_info['host_types']['hostnames'])}개
• 분석 범위: {scope_info['scope_type']} ({scope_info['target_description']})

분석 시 고려사항:
1. 이 분석 결과는 지정된 Host에 국한된 성능 특성을 반영합니다
2. Host별 하드웨어, 네트워크 구성, 트래픽 패턴 차이를 고려해야 합니다
3. 문제 진단 시 Host-specific 요인(장비 상태, 연결성 등)을 우선 검토하십시오
4. 권장 조치는 해당 Host 환경에 특화된 실행 가능한 항목으로 제시하십시오
"""
    
    # 기본 프롬프트에 Host 컨텍스트 삽입
    # [컨텍스트 및 가정] 섹션 뒤에 추가
    context_section_end = "[입력 데이터]"
    if context_section_end in base_prompt:
        insertion_point = base_prompt.find(context_section_end)
        enhanced_prompt = (
            base_prompt[:insertion_point] + 
            host_context_section + 
            "\n" + 
            base_prompt[insertion_point:]
        )
    else:
        # 섹션을 찾을 수 없는 경우 프롬프트 끝에 추가
        enhanced_prompt = base_prompt + host_context_section
    
    logger.info("LLM 프롬프트에 Host 컨텍스트 추가 완료")
    return enhanced_prompt


def enhance_result_payload_with_host_metadata(
    base_payload: Dict[str, Any],
    host_diagnostic_context: Dict[str, Any]
) -> Dict[str, Any]:
    """
    결과 payload에 Host 메타데이터를 추가합니다.
    
    Args:
        base_payload: 기본 결과 payload
        host_diagnostic_context: Host 진단 컨텍스트
        
    Returns:
        Dict[str, Any]: Host 메타데이터가 추가된 payload
    """
    if not host_diagnostic_context.get("host_filtering", {}).get("enabled"):
        return base_payload
    
    # Host 메타데이터 추가
    enhanced_payload = base_payload.copy()
    
    # target_scope 필드 추가/업데이트
    if "target_scope" not in enhanced_payload:
        enhanced_payload["target_scope"] = {}
    
    host_info = host_diagnostic_context["host_filtering"]
    enhanced_payload["target_scope"].update({
        "host_ids": host_info["host_list"],
        "primary_host": host_info["primary_host"],
        "scope_type": host_diagnostic_context["analysis_scope"]["scope_type"]
    })
    
    # filter_metadata 필드 추가/업데이트
    if "filter_metadata" not in enhanced_payload:
        enhanced_payload["filter_metadata"] = {}
    
    enhanced_payload["filter_metadata"].update({
        "applied_host_count": host_info["host_count"],
        "host_types_distribution": {
            "ip_count": len(host_info["host_types"]["ip_addresses"]),
            "hostname_count": len(host_info["host_types"]["hostnames"]),
            "unknown_count": len(host_info["host_types"]["unknown"])
        }
    })
    
    # host_analysis_context 필드 추가
    enhanced_payload["host_analysis_context"] = {
        "target_description": host_diagnostic_context["analysis_scope"]["target_description"],
        "data_coverage": host_diagnostic_context["data_coverage"],
        "filter_combination": host_diagnostic_context["filter_combination"]
    }
    
    logger.info("결과 payload에 Host 메타데이터 추가 완료")
    return enhanced_payload


def _is_ip_address(host: str) -> bool:
    """Host가 IP 주소인지 확인합니다."""
    try:
        import ipaddress
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def _is_hostname(host: str) -> bool:
    """Host가 호스트명인지 확인합니다."""
    import re
    # 기본적인 호스트명 패턴 (영숫자, 하이픈, 점 포함)
    hostname_pattern = r'^[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$'
    return bool(re.match(hostname_pattern, host))


def _analyze_filter_combination(
    host_filters: List[str], 
    ne_filters: List[str], 
    cellid_filters: List[str]
) -> Dict[str, Any]:
    """필터 조합을 분석합니다."""
    return {
        "filter_types_applied": [
            t for t, filters in [
                ("host", host_filters), 
                ("ne", ne_filters), 
                ("cell", cellid_filters)
            ] if filters
        ],
        "total_filter_count": len(host_filters) + len(ne_filters) + len(cellid_filters),
        "is_multi_dimensional": sum([
            bool(host_filters), 
            bool(ne_filters), 
            bool(cellid_filters)
        ]) > 1,
        "specificity_level": "high" if all([host_filters, ne_filters, cellid_filters]) else 
                           "medium" if any([host_filters, ne_filters, cellid_filters]) else "low"
    }


def _analyze_data_coverage(n1_size: int, n_size: int) -> Dict[str, Any]:
    """데이터 커버리지를 분석합니다."""
    total_records = n1_size + n_size
    
    return {
        "n_minus_1_records": n1_size,
        "n_records": n_size,
        "total_records": total_records,
        "data_availability": {
            "n_minus_1": "available" if n1_size > 0 else "no_data",
            "n": "available" if n_size > 0 else "no_data"
        },
        "data_balance": abs(n1_size - n_size) / max(n1_size, n_size, 1) if max(n1_size, n_size) > 0 else 0,
        "confidence_level": "high" if total_records > 100 else "medium" if total_records > 10 else "low"
    }


def _create_target_description(
    host_filters: List[str], 
    ne_filters: List[str], 
    cellid_filters: List[str]
) -> str:
    """타겟에 대한 설명을 생성합니다."""
    parts = []
    
    if host_filters:
        if len(host_filters) == 1:
            parts.append(f"Host: {host_filters[0]}")
        else:
            parts.append(f"Hosts: {len(host_filters)}개")
    
    if ne_filters:
        if len(ne_filters) == 1:
            parts.append(f"NE: {ne_filters[0]}")
        else:
            parts.append(f"NEs: {len(ne_filters)}개")
    
    if cellid_filters:
        if len(cellid_filters) == 1:
            parts.append(f"Cell: {cellid_filters[0]}")
        else:
            parts.append(f"Cells: {len(cellid_filters)}개")
    
    return ", ".join(parts) if parts else "전체 네트워크"


# 통합 함수: analysis_llm.py에서 사용할 메인 함수
def apply_host_enhancement_to_analysis(
    host_filters: List[str],
    ne_filters: List[str],
    cellid_filters: List[str],
    n1_df_size: int,
    n_df_size: int,
    base_prompt: str,
    base_payload: Dict[str, Any]
) -> tuple[str, Dict[str, Any], Dict[str, Any]]:
    """
    Host 필터링이 적용된 분석에 대한 포괄적인 강화를 수행합니다.
    
    Returns:
        tuple: (강화된 프롬프트, 강화된 payload, 진단 컨텍스트)
    """
    if not host_filters:
        logger.info("Host 필터가 없어 Host 강화를 건너뜁니다")
        return base_prompt, base_payload, {}
    
    logger.info(f"Host 강화 적용 시작: {len(host_filters)}개 Host")
    
    # 1. 진단 컨텍스트 생성
    diagnostic_context = create_host_diagnostic_context(
        host_filters, ne_filters, cellid_filters, n1_df_size, n_df_size
    )
    
    # 2. 프롬프트 강화
    enhanced_prompt = enhance_llm_prompt_with_host_context(base_prompt, diagnostic_context)
    
    # 3. Payload 강화
    enhanced_payload = enhance_result_payload_with_host_metadata(base_payload, diagnostic_context)
    
    logger.info("Host 강화 적용 완료")
    return enhanced_prompt, enhanced_payload, diagnostic_context


if __name__ == "__main__":
    # 테스트 실행
    print("🧪 Host 강화 모듈 테스트")
    
    # 샘플 데이터
    host_filters = ["192.168.1.1", "host01"]
    ne_filters = ["nvgnb#10000"]
    cellid_filters = ["2010", "8418"]
    
    # 진단 컨텍스트 생성 테스트
    context = create_host_diagnostic_context(host_filters, ne_filters, cellid_filters, 100, 95)
    
    print(f"✅ 진단 컨텍스트 생성: {context['host_filtering']['host_count']}개 Host")
    print(f"✅ 필터 조합 분석: {context['filter_combination']['specificity_level']} 특정도")
    print(f"✅ 데이터 커버리지: {context['data_coverage']['confidence_level']} 신뢰도")
    
    # 프롬프트 강화 테스트
    base_prompt = """
[컨텍스트 및 가정]
- 테스트 프롬프트

[입력 데이터]
- 테스트 데이터
"""
    
    enhanced_prompt = enhance_llm_prompt_with_host_context(base_prompt, context)
    assert "[Host 타겟 분석 컨텍스트]" in enhanced_prompt
    print("✅ 프롬프트 강화 완료")
    
    # Payload 강화 테스트
    base_payload = {"analysis_type": "test"}
    enhanced_payload = enhance_result_payload_with_host_metadata(base_payload, context)
    assert "target_scope" in enhanced_payload
    assert "host_analysis_context" in enhanced_payload
    print("✅ Payload 강화 완료")
    
    print("\n🎉 모든 Host 강화 기능 테스트 통과!")
