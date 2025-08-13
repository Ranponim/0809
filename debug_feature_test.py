import os
import json
import pandas as pd

from analysis_llm import (
    _safe_eval_expr,
    compute_derived_pegs_for_period,
    process_and_visualize,
    create_llm_analysis_prompt_specific_pegs,
    generate_multitab_html_report,
)


def main():
    # 1) _safe_eval_expr 테스트
    variables = {
        "Random_access_preamble_count": 200,
        "Random_access_response": 180,
    }
    expr = "Random_access_preamble_count/Random_access_response*100"
    val = _safe_eval_expr(expr, variables)
    assert 110.0 <= val <= 111.2, f"expr eval unexpected: {val}"

    # 2) 파생 PEG 계산 + 병합 후 프로세싱
    n1_base = pd.DataFrame([
        {"peg_name": "Random_access_preamble_count", "avg_value": 200, "period": "N-1"},
        {"peg_name": "Random_access_response", "avg_value": 190, "period": "N-1"},
    ])
    n_base = pd.DataFrame([
        {"peg_name": "Random_access_preamble_count", "avg_value": 220, "period": "N"},
        {"peg_name": "Random_access_response", "avg_value": 200, "period": "N"},
    ])
    defs = {"telus_RACH_Success": expr}
    n1_derived = compute_derived_pegs_for_period(n1_base, defs, "N-1")
    n_derived = compute_derived_pegs_for_period(n_base, defs, "N")
    n1_df = pd.concat([n1_base, n1_derived], ignore_index=True)
    n_df = pd.concat([n_base, n_derived], ignore_index=True)

    processed_df, charts = process_and_visualize(n1_df, n_df)
    assert "telus_RACH_Success" in processed_df["peg_name"].tolist(), "derived peg missing in processed_df"

    # 3) 특정 PEG 프롬프트 생성 (정확 일치 대상만)
    selected = ["Random_access_preamble_count", "telus_RACH_Success"]
    subset = processed_df[processed_df["peg_name"].isin(selected)]
    sp_prompt = create_llm_analysis_prompt_specific_pegs(subset, selected, "2025-07-01_00:00~2025-07-01_23:59", "2025-07-02_00:00~2025-07-02_23:59")
    assert "telus_RACH_Success" in sp_prompt, "specific prompt missing derived peg"

    # 4) HTML 렌더링: specific_peg_analysis 구조를 넣어 탭 렌더링 확인
    llm_analysis = {
        "executive_summary": "요약",
        "specific_peg_analysis": {
            "selected_pegs": selected,
            "summary": "선택된 PEG에 대한 요약",
            "peg_insights": {"telus_RACH_Success": "정상 범위"},
            "prioritized_actions": [{"priority": "P1", "action": "점검", "details": "RACH 파라미터"}],
        },
    }
    out_dir = os.path.abspath("./analysis_output_test")
    path = generate_multitab_html_report(llm_analysis, charts, out_dir, processed_df)
    assert os.path.exists(path), "HTML report not generated"

    print(json.dumps({
        "expr_val": val,
        "rows": len(processed_df),
        "report_path": path,
        "has_specific_tab": True,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()


