#!/usr/bin/env python3
"""
LLM 분석 테스트 스크립트
테스트 데이터를 생성하고 분석 결과를 확인합니다.
"""

import json
import requests
import time
from datetime import datetime, timedelta

# API 엔드포인트 설정
BASE_URL = "http://localhost:8000"

def create_test_analysis_data():
    """테스트용 LLM 분석 데이터를 생성합니다."""

    # 현재 시간 기준으로 기간 설정
    now = datetime.now()
    n_minus_1_start = (now - timedelta(days=1)).strftime("%Y-%m-%d_00:00")
    n_minus_1_end = (now - timedelta(days=1)).strftime("%Y-%m-%d_23:59")
    n_start = now.strftime("%Y-%m-%d_00:00")
    n_end = now.strftime("%Y-%m-%d_23:59")

    test_data = {
        "db_config": {
            "host": "localhost",
            "port": 5432,
            "user": "postgres",
            "password": "password",
            "dbname": "postgres",
            "table": "summary"
        },
        "n_minus_1": f"{n_minus_1_start}~{n_minus_1_end}",
        "n": f"{n_start}~{n_end}",
        "ne": "TEST_NE_001",
        "cellid": "TEST_CELL_001",
        "enable_mock": True,  # 테스트 모드 활성화
        "user_id": "test_user"
    }

    return test_data

def trigger_llm_analysis():
    """LLM 분석을 트리거합니다."""
    print("🚀 LLM 분석 테스트 시작...")

    test_data = create_test_analysis_data()
    print(f"📊 테스트 데이터: {json.dumps(test_data, indent=2, ensure_ascii=False)}")

    try:
        # LLM 분석 트리거
        response = requests.post(
            f"{BASE_URL}/api/analysis/trigger-llm-analysis",
            json=test_data,
            timeout=30
        )

        if response.status_code == 202:
            result = response.json()
            analysis_id = result.get("analysis_id")
            print(f"✅ 분석 요청 성공! 분석 ID: {analysis_id}")
            return analysis_id
        else:
            print(f"❌ 분석 요청 실패: {response.status_code}")
            print(f"응답: {response.text}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ 요청 오류: {e}")
        return None

def check_analysis_status(analysis_id):
    """분석 상태를 확인합니다."""
    print(f"🔍 분석 상태 확인 중... (ID: {analysis_id})")

    try:
        response = requests.get(
            f"{BASE_URL}/api/analysis/results",
            params={"analysis_type": "llm_analysis"},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            results = data.get("data", {}).get("items", [])

            # 해당 분석 ID를 찾기
            for result in results:
                if result.get("analysis_id") == analysis_id:
                    status = result.get("status")
                    print(f"📋 분석 상태: {status}")

                    if status == "success":
                        return result
                    elif status == "error":
                        print(f"❌ 분석 실패: {result.get('error', '알 수 없는 오류')}")
                        return None
                    else:
                        return None

            print("⏳ 분석 결과 아직 생성되지 않음")
            return None
        else:
            print(f"❌ 상태 확인 실패: {response.status_code}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ 상태 확인 오류: {e}")
        return None

def display_analysis_result(result):
    """분석 결과를 표시합니다."""
    print("\n" + "="*50)
    print("🎯 LLM 분석 결과")
    print("="*50)

    print(f"📅 분석 날짜: {result.get('analysis_date', 'N/A')}")
    print(f"🏷️ 분석 유형: {result.get('analysis_type', 'N/A')}")
    print(f"📊 상태: {result.get('status', 'N/A')}")
    print(f"🆔 NE ID: {result.get('ne_id', 'N/A')}")
    print(f"📱 Cell ID: {result.get('cell_id', 'N/A')}")

    # 분석 결과 표시
    analysis_data = result.get('data', {})
    if analysis_data:
        analysis = analysis_data.get('analysis', {})
        if analysis:
            print("\n📋 분석 내용:")

            # 종합 요약
            summary = analysis.get('executive_summary') or analysis.get('overall_summary')
            if summary:
                print(f"📝 요약: {summary}")

            # 핵심 발견사항
            findings = analysis.get('diagnostic_findings', [])
            if findings:
                print("
🔍 핵심 발견사항:"                for i, finding in enumerate(findings[:3], 1):  # 상위 3개만 표시
                    hypothesis = finding.get('primary_hypothesis', 'N/A')
                    print(f"  {i}. {hypothesis}")

            # 권장 조치
            actions = analysis.get('recommended_actions', [])
            if actions:
                print("
💡 권장 조치:"                for i, action in enumerate(actions[:3], 1):  # 상위 3개만 표시
                    action_text = action.get('action', 'N/A')
                    print(f"  {i}. {action_text}")

    print("\n" + "="*50)

def main():
    """메인 함수"""
    print("🧪 LLM 분석 테스트 실행")
    print("-" * 30)

    # 1. 백엔드 연결 확인
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        if response.status_code == 200:
            print("✅ 백엔드 서버 연결 성공")
        else:
            print("❌ 백엔드 서버 응답 오류")
            return
    except requests.exceptions.RequestException:
        print("❌ 백엔드 서버에 연결할 수 없습니다.")
        print("💡 백엔드 서버가 실행 중인지 확인해주세요.")
        return

    # 2. LLM 분석 트리거
    analysis_id = trigger_llm_analysis()
    if not analysis_id:
        print("❌ 분석 요청 실패")
        return

    # 3. 분석 완료 대기 및 결과 확인
    print("\n⏳ 분석 완료 대기 중...")
    max_attempts = 30  # 최대 5분 대기
    attempt = 0

    while attempt < max_attempts:
        time.sleep(10)  # 10초 대기
        attempt += 1

        result = check_analysis_status(analysis_id)
        if result:
            display_analysis_result(result)
            break

        print(f"⏳ 대기 중... ({attempt}/{max_attempts})")

    if attempt >= max_attempts:
        print("⏰ 분석 시간이 초과되었습니다.")
        print("💡 백엔드 로그를 확인하여 분석 진행 상황을 확인해주세요.")

if __name__ == "__main__":
    main()
