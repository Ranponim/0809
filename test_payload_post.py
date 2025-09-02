#!/usr/bin/env python3
"""
=====================================================================================
Cell 성능 LLM 분석기 - Payload POST 테스트
=====================================================================================

이 스크립트는 analysis_llm.py에서 생성되는 payload를 임의로 생성하여
백엔드 API로 POST 요청을 보내는 테스트를 수행합니다.

사용법:
    python test_payload_post.py
"""

import os
import json
import requests
import datetime
from typing import Dict, Any, List
import logging

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def get_default_tzinfo():
    """기본 타임존 정보 생성"""
    return datetime.timezone(datetime.timedelta(hours=9))


def generate_mock_stats_records() -> List[Dict[str, Any]]:
    """임의의 stats 레코드를 생성합니다."""
    return [
        {
            "period": "N-1",
            "kpi_name": "Random_access_preamble_count",
            "avg": 1250.5,
            "std": 45.2,
            "min": 1100.0,
            "max": 1400.0,
            "count": 1440
        },
        {
            "period": "N-1",
            "kpi_name": "Random_access_response",
            "avg": 1200.8,
            "std": 38.7,
            "min": 1050.0,
            "max": 1350.0,
            "count": 1440
        },
        {
            "period": "N",
            "kpi_name": "Random_access_preamble_count",
            "avg": 1180.3,
            "std": 42.1,
            "min": 1000.0,
            "max": 1300.0,
            "count": 1440
        },
        {
            "period": "N",
            "kpi_name": "Random_access_response",
            "avg": 1150.6,
            "std": 35.9,
            "min": 980.0,
            "max": 1250.0,
            "count": 1440
        }
    ]


def generate_mock_analysis_section() -> Dict[str, Any]:
    """임의의 analysis 섹션을 생성합니다."""
    return {
        "executive_summary": "N-1과 N 기간 동안의 셀 성능 분석 결과입니다. RACH 성공률에 약간의 감소가 관찰되었으나 전체적으로 안정적인 성능을 유지하고 있습니다.",
        "diagnostic_findings": [
            {
                "primary_hypothesis": "트래픽 증가로 인한 RACH 부하 증가",
                "supporting_evidence": "N 기간의 preamble count가 N-1에 비해 약 5.6% 감소하였으나, response 또한 비례적으로 감소하여 성공률은 유지됨",
                "confounding_factors_assessment": "동일한 시험환경 가정 하에 트래픽 증가가 가장 가능성이 높은 원인으로 판단됨"
            }
        ],
        "recommended_actions": [
            {
                "priority": "P2",
                "action": "RACH 파라미터 최적화 검토",
                "details": "preambleFormat, ra-ResponseWindowSize 등 파라미터 조정 검토"
            }
        ],
        "assumptions": {
            "same_environment": True
        },
        "source_metadata": {
            "db_config": {
                "host": "127.0.0.1",
                "port": 5432,
                "user": "postgres",
                "dbname": "netperf"
            },
            "table": "summary",
            "columns": {
                "time": "datetime",
                "peg_name": "peg_name",
                "value": "value"
            },
            "ne_id": "nvgnb#10000",
            "cell_id": "2010"
        }
    }


def generate_mock_results_overview() -> Dict[str, Any]:
    """임의의 results overview를 생성합니다."""
    return {
        "summary": "N-1과 N 기간의 PEG 데이터를 분석한 결과입니다.",
        "key_findings": [
            "RACH preamble count: 5.6% 감소",
            "RACH response: 4.2% 감소",
            "전체 성공률: 안정적 유지"
        ],
        "recommended_actions": [
            "RACH 파라미터 모니터링 강화",
            "트래픽 패턴 분석",
            "필요시 파라미터 튜닝"
        ]
    }


def generate_mock_request_params() -> Dict[str, Any]:
    """임의의 request parameters를 생성합니다."""
    return {
        "n_minus_1": "2025-08-14_00:00~2025-08-14_23:59",
        "n": "2025-08-15_00:00~2025-08-15_23:59",
        "output_dir": "./analysis_output",
        "db": {
            "host": "127.0.0.1",
            "port": 5432,
            "user": "postgres",
            "password": "****",
            "dbname": "netperf"
        },
        "table": "summary",
        "columns": {
            "time": "datetime",
            "peg_name": "peg_name",
            "value": "value"
        },
        "preference": "Random_access_preamble_count,Random_access_response",
        "peg_definitions": {
            "telus_RACH_Success": "Random_access_preamble_count/Random_access_response*100"
        }
    }


def generate_mock_payload() -> Dict[str, Any]:
    """analysis_llm.py에서 생성되는 것과 유사한 임의의 payload를 생성합니다."""
    tzinfo = get_default_tzinfo()

    # 현재 구조 (API 모델과 일부 불일치)
    payload = {
        "analysis_type": "llm_analysis",  # API 모델에는 있지만 현재 payload에 누락된 필드
        "analysisDate": datetime.datetime.now(tz=tzinfo).isoformat(),
        "neId": "nvgnb#10000",
        "cellId": "2010",
        "status": "success",
        "report_path": "./analysis_output/Cell_Analysis_Report_2025-08-15_14-30.html",
        "results": [],  # 빈 배열
        "stats": generate_mock_stats_records(),
        "analysis": generate_mock_analysis_section(),
        "resultsOverview": generate_mock_results_overview(),
        "analysisRawCompact": {
            "executive_summary": "압축된 분석 요약...",
            "key_metrics": {
                "rach_success_rate": 96.5,
                "total_samples": 2880
            }
        },
        "request_params": generate_mock_request_params()
    }

    return payload


def test_payload_post(backend_url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """생성된 payload를 백엔드로 POST 요청합니다."""

    logger.info("=== Payload POST 테스트 시작 ===")
    logger.info(f"백엔드 URL: {backend_url}")

    # Payload 크기 확인
    payload_json = json.dumps(payload, ensure_ascii=False)
    payload_size = len(payload_json.encode('utf-8'))
    logger.info(f"Payload 크기: {payload_size} bytes")

    # JSON 직렬화 검증
    try:
        parsed = json.loads(payload_json)
        logger.info("✅ JSON 직렬화 성공")
    except Exception as e:
        logger.error(f"❌ JSON 직렬화 실패: {e}")
        return {"status": "error", "message": f"JSON 직렬화 실패: {e}"}

    # POST 요청
    try:
        logger.info("POST 요청 시작...")
        headers = {
            'Content-Type': 'application/json; charset=utf-8'
        }

        response = requests.post(
            backend_url,
            data=payload_json.encode('utf-8'),
            headers=headers,
            timeout=30
        )

        logger.info(f"응답 상태 코드: {response.status_code}")

        # 응답 분석
        result = {
            "status": "success" if response.status_code in [200, 201] else "error",
            "status_code": response.status_code,
            "response_headers": dict(response.headers),
            "response_time": response.elapsed.total_seconds()
        }

        try:
            response_json = response.json()
            result["response_body"] = response_json
            logger.info(f"응답 본문: {json.dumps(response_json, ensure_ascii=False, indent=2)}")
        except:
            result["response_body"] = response.text
            logger.info(f"응답 본문 (텍스트): {response.text[:500]}...")

        if response.status_code in [200, 201]:
            logger.info("✅ POST 요청 성공")
        else:
            logger.error(f"❌ POST 요청 실패: {response.status_code}")
            logger.error(f"응답 내용: {response.text[:1000]}")

        return result

    except requests.exceptions.Timeout:
        logger.error("❌ 요청 타임아웃")
        return {"status": "error", "message": "요청 타임아웃"}
    except requests.exceptions.ConnectionError:
        logger.error("❌ 연결 실패")
        return {"status": "error", "message": "연결 실패"}
    except Exception as e:
        logger.error(f"❌ 예상치 못한 오류: {e}")
        return {"status": "error", "message": f"예상치 못한 오류: {e}"}


def save_test_results(test_result: Dict[str, Any], payload: Dict[str, Any]):
    """테스트 결과를 파일로 저장합니다."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")

    result_data = {
        "timestamp": timestamp,
        "test_result": test_result,
        "payload_used": payload
    }

    filename = f"payload_test_result_{timestamp}.json"
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)
        logger.info(f"테스트 결과 저장됨: {filename}")
    except Exception as e:
        logger.error(f"결과 저장 실패: {e}")


def main():
    """메인 테스트 함수"""

    # 환경변수에서 백엔드 URL 읽기 (기본값 제공)
    backend_url = os.getenv('BACKEND_ANALYSIS_URL', 'http://165.213.69.30:8000/api/analysis/results/')

    logger.info("=== Payload POST 테스트 ===")
    logger.info(f"대상 백엔드: {backend_url}")

    # 임의의 payload 생성
    logger.info("임의의 payload 생성 중...")
    payload = generate_mock_payload()

    # 생성된 payload 로그
    logger.info("생성된 payload 구조:")
    logger.info(f"- analysis_type: {payload.get('analysis_type')}")
    logger.info(f"- analysisDate: {payload.get('analysisDate')}")
    logger.info(f"- neId: {payload.get('neId')}")
    logger.info(f"- cellId: {payload.get('cellId')}")
    logger.info(f"- status: {payload.get('status')}")
    logger.info(f"- stats 개수: {len(payload.get('stats', []))}")

    # POST 테스트 실행
    test_result = test_payload_post(backend_url, payload)

    # 결과 저장
    save_test_results(test_result, payload)

    # 최종 결과 출력
    logger.info("=== 테스트 완료 ===")
    logger.info(f"최종 상태: {test_result.get('status', 'unknown')}")
    if test_result.get('status_code'):
        logger.info(f"HTTP 상태 코드: {test_result.get('status_code')}")

    return test_result


if __name__ == "__main__":
    result = main()

    # 성공/실패에 따른 종료 코드
    if result.get('status') == 'success':
        exit(0)
    else:
        exit(1)


