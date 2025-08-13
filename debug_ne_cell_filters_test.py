import os
import json
import datetime

import analysis_llm as mod


class FakeCursor:
    def __init__(self, rows):
        self._rows = rows
        self.sql = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params):
        self.sql = sql
        self.params = params

    def fetchall(self):
        return self._rows


class FakeConn:
    def __init__(self, rows):
        self._rows = rows
        self.last_cursor = None

    def cursor(self, cursor_factory=None):
        self.last_cursor = FakeCursor(self._rows)
        return self.last_cursor

    def close(self):
        pass


def test_fetch_with_filters():
    # 준비: 가짜 결과 세트 (peg_name, avg_value)
    rows = [("PEG_A", 10.0), ("PEG_B", 20.0)]
    conn = FakeConn(rows)
    table = "summary"
    columns = {"time": "datetime", "peg_name": "peg_name", "value": "value", "ne": "ne", "cellid": "cellid"}
    start = datetime.datetime(2025, 7, 1, 0, 0)
    end = datetime.datetime(2025, 7, 1, 23, 59)

    # 케이스1: ne 단일
    df = mod.fetch_cell_averages_for_period(conn, table, columns, start, end, "N-1", ne_filters=["nvgnb#10000"], cellid_filters=None)
    cur = conn.last_cursor
    assert " AND ne = %s" in cur.sql, f"NE 단일 필터 SQL 누락: {cur.sql}"
    assert list(cur.params[:2]) == [start, end]
    assert cur.params[-1] == "nvgnb#10000"
    assert "GROUP BY peg_name" in cur.sql
    assert "period" in df.columns

    # 케이스2: cellid 다중
    df2 = mod.fetch_cell_averages_for_period(conn, table, columns, start, end, "N", ne_filters=None, cellid_filters=["2010", "2011"])
    cur2 = conn.last_cursor
    assert " cellid IN (" in cur2.sql, f"cellid IN 절 누락: {cur2.sql}"
    assert len(cur2.params) == 2 + 2  # time params + 2 cellids
    assert set(cur2.params[2:]) == {"2010", "2011"}
    assert len(df2) == len(rows)


def test_e2e_analyze_with_filters_and_derivation(tmp_dir):
    # 가짜 DB 연결 주입, LLM/HTML 함수도 최소 동작 모킹
    fake_rows = [("A", 100.0), ("B", 50.0)]
    fake_conn = FakeConn(fake_rows)

    original_get_db = mod.get_db_connection
    original_llm = mod.query_llm
    original_html = mod.generate_multitab_html_report

    try:
        mod.get_db_connection = lambda db: fake_conn
        mod.query_llm = lambda prompt: {"executive_summary": "ok"}
        mod.generate_multitab_html_report = lambda llm, charts, out_dir, df: os.path.join(out_dir, "ok.html")

        req = {
            "n_minus_1": "2025-07-01_00:00~2025-07-01_23:59",
            "n": "2025-07-02_00:00~2025-07-02_23:59",
            "output_dir": str(tmp_dir),
            "table": "summary",
            "columns": {"time": "datetime", "peg_name": "peg_name", "value": "value", "ne": "ne", "cellid": "cellid"},
            "ne": "nvgnb#10000",
            "cellid": "2010,2011",
            "peg_definitions": {"DERIVED": "A/B*100"},
            "preference": ["A", "DERIVED"],
        }
        res = mod._analyze_cell_performance_logic(req)
        assert res.get("status") == "success", res
        assert "analysis" in res
        assert isinstance(res["stats"], list) and len(res["stats"]) >= 2
    finally:
        mod.get_db_connection = original_get_db
        mod.query_llm = original_llm
        mod.generate_multitab_html_report = original_html


def main():
    test_fetch_with_filters()
    # 임시 디렉토리 준비
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        test_e2e_analyze_with_filters_and_derivation(d)
    print(json.dumps({"ok": True}, ensure_ascii=False))


if __name__ == "__main__":
    main()


