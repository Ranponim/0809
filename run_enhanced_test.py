import os
import json
import pandas as pd

from analysis_llm import (
    create_llm_analysis_prompt_enhanced,
    generate_multitab_html_report,
)


def main():
    # 샘플 집계 데이터프레임 구성
    data = [
        {"peg_name": "Accessibility_Attempts", "avg_n_minus_1": 1000, "avg_n": 900, "diff": -100, "pct_change": -10.0},
        {"peg_name": "Retainability_Drops", "avg_n_minus_1": 50, "avg_n": 80, "diff": 30, "pct_change": 60.0},
        {"peg_name": "Mobility_HO_Success", "avg_n_minus_1": 98.5, "avg_n": 97.1, "diff": -1.4, "pct_change": -1.42},
    ]
    df = pd.DataFrame(data)

    # 프롬프트 생성 테스트
    prompt = create_llm_analysis_prompt_enhanced(
        processed_df=df,
        n1_range="2025-07-01_00:00~2025-07-01_23:59",
        n_range="2025-07-02_00:00~2025-07-02_23:59",
    )
    assert isinstance(prompt, str) and len(prompt) > 100, "프롬프트 생성 실패 또는 너무 짧음"

    # LLM 분석 결과(모의) 구성: 새 스키마 사용
    llm_analysis = {
        "executive_summary": "기간 n에서 Retainability 악화와 Accessibility 저하가 관찰됨.",
        "diagnostic_findings": [
            {
                "primary_hypothesis": "랜 무선 혼잡에 따른 RRC 연결 실패율 상승",
                "supporting_evidence": "Accessibility_Attempts 감소 및 Mobility_HO_Success 저하 동반",
                "confounding_factors_assessment": "SW 패치/라우팅 변경 가능성 낮음 (동일 환경 가정)"
            }
        ],
        "recommended_actions": [
            {"priority": "P1", "action": "RACH 관련 카운터(pmRachAtt, pmRachSucc) 시계열 점검", "details": "셀 그룹 레벨로 분해하여 급격 변화 구간 확인"},
            {"priority": "P2", "action": "혼잡 완화 파라미터 재검토", "details": "PRACH 구간, 핸드오버 타이머 등 재튜닝"}
        ]
    }

    # 1x1 투명 PNG Base64 (차트 자리 채우기용)
    transparent_png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
    )
    charts = {"overall": transparent_png_b64}

    # HTML 리포트 생성 테스트
    out_dir = os.path.abspath("./analysis_output_test")
    report_path = generate_multitab_html_report(llm_analysis, charts, out_dir, df)
    assert os.path.exists(report_path), "HTML 리포트가 생성되지 않았습니다."

    # 결과 요약 출력
    result = {
        "prompt_length": len(prompt),
        "report_path": report_path,
        "findings_count": len(llm_analysis.get("diagnostic_findings", [])),
        "actions_count": len(llm_analysis.get("recommended_actions", [])),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()


