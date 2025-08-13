from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
import random
from datetime import datetime, timedelta
import os
import psycopg2
import psycopg2.extras
from fastapi import Body
from dotenv import load_dotenv
import logging
import time
import math
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

app = FastAPI(title="3GPP KPI Management API", version="1.0.0")

# 환경 변수 로드 (.env)
load_dotenv()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 데이터 모델 정의
class KPIData(BaseModel):
    timestamp: str
    entity_id: str
    kpi_type: str
    value: float

class PreferenceModel(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    config: dict

class SummaryReport(BaseModel):
    id: int
    title: str
    content: str
    generated_at: str

# 분석 결과 모델
class AnalysisResult(BaseModel):
    id: int
    status: str
    n_minus_1: Optional[str] = None
    n: Optional[str] = None
    analysis: Dict[str, Any]
    stats: List[Dict[str, Any]] = []
    chart_overall_base64: Optional[str] = None
    report_path: Optional[str] = None
    created_at: str

# 인메모리 저장소 (MVP)
analysis_results: List[AnalysisResult] = []
analysis_counter: int = 1

# 영구 저장소 (SQLite via SQLAlchemy)
def _build_analysis_db_url() -> str:
    """PostgreSQL 우선 영구 저장 DSN 구성.
    - ANALYSIS_DB_URL 이 지정되면 그대로 사용 (예: postgresql+psycopg2://user:pass@host:5432/db)
    - 아니면 ANALYSIS_PG_* 환경변수로 DSN 생성
    - 미설정 시 명시적으로 오류 발생 (요구사항: PostgreSQL 영구 저장)
    """
    dsn = os.getenv("ANALYSIS_DB_URL")
    if dsn:
        return dsn
    host = os.getenv("ANALYSIS_PG_HOST")
    if host:
        port = os.getenv("ANALYSIS_PG_PORT", "5432")
        user = os.getenv("ANALYSIS_PG_USER", "postgres")
        password = os.getenv("ANALYSIS_PG_PASSWORD", "")
        dbname = os.getenv("ANALYSIS_PG_DBNAME", "postgres")
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{dbname}"
    raise RuntimeError("Set ANALYSIS_DB_URL or ANALYSIS_PG_* envs for PostgreSQL persistence")

ANALYSIS_DB_URL = _build_analysis_db_url()
engine = create_engine(ANALYSIS_DB_URL, future=True, pool_pre_ping=True)
Base = declarative_base()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

class AnalysisResultRecord(Base):
    __tablename__ = "analysis_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(String(32), nullable=False)
    n_minus_1 = Column(String(64))
    n = Column(String(64))
    analysis_json = Column(Text)  # JSON 문자열
    stats_json = Column(Text)     # JSON 문자열
    chart_overall_base64 = Column(Text)
    report_path = Column(Text)
    created_at = Column(DateTime, nullable=False)

Base.metadata.create_all(bind=engine)

def _sanitize_for_json(value: Any) -> Any:
    """JSON 직렬화 호환을 위해 NaN/Infinity 값을 None으로 정규화한다.
    dict/list 등 중첩 구조를 재귀적으로 순회한다.
    """
    try:
        if isinstance(value, float):
            # 비유한수 값(NaN, +/-Infinity)은 JSON 표준 미준수 → None으로 교체
            return value if math.isfinite(value) else None
        if isinstance(value, dict):
            return {k: _sanitize_for_json(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_sanitize_for_json(v) for v in value]
        return value
    except Exception:
        # 예외 시 원본을 안전하게 반환 (로깅은 호출부에서 수행)
        return value

def _record_to_model(rec: AnalysisResultRecord) -> AnalysisResult:
    # 저장된 JSON 문자열에 비표준 NaN 토큰이 포함되어 있어도 Python json.loads 는 파싱하나,
    # 응답 직렬화 시 allow_nan=False 정책으로 인해 오류가 발생할 수 있으므로 정규화한다.
    try:
        raw_analysis = json.loads(rec.analysis_json or "{}")
        raw_stats = json.loads(rec.stats_json or "[]")
    except Exception as e:
        logging.warning("레코드 JSON 로드 실패(id=%s): %s", rec.id, e)
        raw_analysis, raw_stats = {}, []

    safe_analysis = _sanitize_for_json(raw_analysis)
    safe_stats = _sanitize_for_json(raw_stats)

    return AnalysisResult(
        id=rec.id,
        status=rec.status,
        n_minus_1=rec.n_minus_1,
        n=rec.n,
        analysis=safe_analysis,
        stats=safe_stats,
        chart_overall_base64=rec.chart_overall_base64,
        report_path=rec.report_path,
        created_at=rec.created_at.isoformat(),
    )

# 가상 데이터 생성 함수
def generate_mock_kpi_data(start_date: str, end_date: str, kpi_type: str, entity_ids: List[str], interval_minutes: int = 60) -> List[KPIData]:
    data = []
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    step = timedelta(minutes=max(1, int(interval_minutes)))
    current = start
    while current <= end:
        for entity_id in entity_ids:
            # KPI 타입별로 다른 범위의 값 생성
            if kpi_type == "availability":
                base_value = 99.0
                value = base_value + random.uniform(-2.0, 1.0)
            elif kpi_type == "rrc":
                base_value = 98.5
                value = base_value + random.uniform(-1.5, 1.0)
            elif kpi_type == "erab":
                base_value = 99.2
                value = base_value + random.uniform(-1.0, 0.8)
            elif kpi_type == "sar":
                base_value = 2.5
                value = base_value + random.uniform(-0.5, 1.0)
            elif kpi_type == "mobility_intra":
                base_value = 95.0
                value = base_value + random.uniform(-5.0, 3.0)
            elif kpi_type == "payload":
                base_value = 500.0
                value = base_value + random.uniform(-100.0, 200.0)
            elif kpi_type == "cqi":
                base_value = 8.0
                value = base_value + random.uniform(-2.0, 2.0)
            elif kpi_type == "se":
                base_value = 2.0
                value = base_value + random.uniform(-0.5, 1.0)
            elif kpi_type == "dl_thp":
                base_value = 10000.0
                value = base_value + random.uniform(-2000.0, 5000.0)
            elif kpi_type == "ul_int":
                base_value = -110.0
                value = base_value + random.uniform(-5.0, 5.0)
            else:
                value = random.uniform(0, 100)
            
            data.append(KPIData(
                timestamp=current.isoformat(),
                entity_id=entity_id,
                kpi_type=kpi_type,
                value=round(value, 2)
            ))
        
        current += step  # 가변 간격 (기본 60분, 5/15분 등)
    
    return data

# 가상 preference 저장소
preferences_db = []
preference_counter = 1

# 가상 리포트 데이터
mock_reports = [
    SummaryReport(
        id=1,
        title="주간 네트워크 성능 분석 리포트",
        content="""
# 주간 네트워크 성능 분석 리포트

## 요약
이번 주 네트워크 성능은 전반적으로 안정적이었으며, 주요 KPI들이 목표치를 달성했습니다.

## 주요 발견사항
- **가용성(Availability)**: 평균 99.1%로 목표치(99.0%) 달성
- **RRC 성공률**: 평균 98.7%로 양호한 수준 유지
- **ERAB 성공률**: 평균 99.3%로 우수한 성능
- **다운링크 처리량**: 평균 12.5 Mbps로 증가 추세

## 권장사항
1. 특정 셀에서 간헐적인 성능 저하 모니터링 필요
2. 피크 시간대 용량 증설 검토
3. 인터페어런스 최적화 작업 수행
        """,
        generated_at="2024-08-13T10:00:00"
    )
]

# API 엔드포인트
@app.get("/")
async def root():
    """헬스 체크 및 간단한 루트 응답."""
    logging.info("GET / 호출")
    return {"message": "3GPP KPI Management API"}

@app.post("/api/analysis-result")
async def post_analysis_result(payload: dict):
    try:
        # 필수 키 점검 및 생성 시간 부여
        created_dt = datetime.utcnow()
        logging.info("POST /api/analysis-result 호출: created_at=%s", created_dt.isoformat())
        with SessionLocal() as s:
            # NaN/Infinity 값 방지: DB 저장 전 정규화 후 직렬화
            analysis_obj = _sanitize_for_json(payload.get("analysis") or {})
            stats_obj = _sanitize_for_json(payload.get("stats") or [])
            try:
                analysis_json = json.dumps(analysis_obj, ensure_ascii=False, allow_nan=False)
                stats_json = json.dumps(stats_obj, ensure_ascii=False, allow_nan=False)
            except ValueError as ve:
                # 여전히 직렬화 실패 시 상세 로그 및 400 반환
                logging.error("분석결과 직렬화 실패(NaN 포함 가능): %s", ve)
                raise HTTPException(status_code=400, detail=f"Invalid numeric values in analysis/stats: {ve}")

            rec = AnalysisResultRecord(
                status=str(payload.get("status", "success")),
                n_minus_1=payload.get("n_minus_1"),
                n=payload.get("n"),
                analysis_json=analysis_json,
                stats_json=stats_json,
                chart_overall_base64=payload.get("chart_overall_base64"),
                report_path=payload.get("report_path"),
                created_at=created_dt,
            )
            s.add(rec)
            s.commit()
            s.refresh(rec)
            logging.info("분석결과 저장 성공: id=%s", rec.id)
            return {"id": rec.id, "created_at": created_dt.isoformat()}
    except Exception as e:
        logging.exception("분석결과 저장 실패")
        raise HTTPException(status_code=400, detail=f"Invalid payload: {e}")

@app.get("/api/analysis-result/latest")
async def get_latest_analysis_result():
    logging.info("GET /api/analysis-result/latest 호출")
    with SessionLocal() as s:
        rec = s.query(AnalysisResultRecord).order_by(AnalysisResultRecord.id.desc()).first()
        if not rec:
            raise HTTPException(status_code=404, detail="No analysis results")
        return _record_to_model(rec)

@app.get("/api/analysis-result/{result_id}")
async def get_analysis_result(result_id: int):
    logging.info("GET /api/analysis-result/%s 호출", result_id)
    with SessionLocal() as s:
        rec = s.query(AnalysisResultRecord).filter(AnalysisResultRecord.id == result_id).first()
        if not rec:
            raise HTTPException(status_code=404, detail="Result not found")
        return _record_to_model(rec)

@app.get("/api/analysis-result")
async def list_analysis_results():
    logging.info("GET /api/analysis-result 호출 (list)")
    with SessionLocal() as s:
        recs = s.query(AnalysisResultRecord).order_by(AnalysisResultRecord.id.desc()).all()
        return {"results": [_record_to_model(r) for r in recs]}

@app.post("/api/kpi/query")
async def kpi_query(payload: dict = Body(...)):
    """
    MVP: DB 설정을 입력으로 받아 KPI 통계를 반환하는 프록시.
    현재 단계에서는 기존 mock 생성기를 사용해 프론트 연동을 우선 보장한다.
    기대 입력 예시:
    {
      "db": {"host":"...","port":5432,"user":"...","password":"...","dbname":"..."},
      "table": "summary",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "kpi_type": "availability",
      "entity_ids": "LHK078ML1,LHK078MR1"
    }
    """
    try:
        start_date = payload.get("start_date")
        end_date = payload.get("end_date")
        kpi_type = payload.get("kpi_type")
        entity_ids = payload.get("entity_ids", "LHK078ML1,LHK078MR1")
        if not start_date or not end_date or not kpi_type:
            raise ValueError("start_date, end_date, kpi_type는 필수입니다")

        # 실제 DB 프록시 시도
        db = payload.get("db") or {}
        table = payload.get("table") or "summary"
        columns = payload.get("columns") or {"time": "datetime", "peg_name": "peg_name", "value": "value"}
        time_col = columns.get("time", "datetime")
        peg_col = columns.get("peg_name", "peg_name")
        value_col = columns.get("value", "value")

        # 식별자 검증 (SQL Injection 방지): 영문/숫자/_ 만 허용
        def _valid_ident(name: str) -> bool:
            return bool(name) and name.replace('_','a').replace('0','0').replace('1','1').isalnum() and all(c.isalnum() or c=='_' for c in name)
        if not all(map(_valid_ident, [table, time_col, peg_col, value_col])):
            raise ValueError("Invalid identifiers in table/columns")

        # 날짜 문자열(YYYY-MM-DD) → 하루 범위
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
        except Exception:
            raise ValueError("start_date/end_date 형식은 YYYY-MM-DD 이어야 합니다")

        ids = [t.strip() for t in str(entity_ids).split(",") if t.strip()]
        logging.info("/api/kpi/query 매개변수: kpi_type=%s, ids=%d, 기간=%s~%s", kpi_type, len(ids), start_date, end_date)

        # SQL: 시간(hour) 버킷으로 평균값 집계. entity_id는 peg_name으로 대응
        sql = (
            f"SELECT date_trunc('hour', {time_col}) AS ts, {peg_col} AS entity_id, AVG({value_col}) AS avg_value "
            f"FROM {table} "
            f"WHERE {time_col} BETWEEN %s AND %s "
            f"  AND {peg_col} = ANY(%s) "
            f"GROUP BY ts, {peg_col} "
            f"ORDER BY ts ASC"
        )
        params = (start_dt, end_dt, ids)

        # 간단 재시도(최대 3회)
        attempt = 0
        last_err = None
        rows = []
        while attempt < 3:
            try:
                attempt += 1
                logging.info("DB 프록시 시도 %d/3: host=%s db=%s table=%s", attempt, db.get('host'), db.get('dbname'), table)
                conn = psycopg2.connect(
                    host=db.get("host"), port=db.get("port", 5432), user=db.get("user"),
                    password=db.get("password"), dbname=db.get("dbname")
                )
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                conn.close()
                break
            except Exception as e:
                last_err = e
                logging.warning("DB 프록시 실패(%d): %s", attempt, e)
                time.sleep(0.5 * attempt)
            finally:
                try:
                    conn.close()
                except Exception:
                    pass
        if last_err and not rows:
            raise last_err

        data = []
        for r in rows:
            data.append({
                "timestamp": r["ts"].isoformat(),
                "entity_id": r["entity_id"],
                "kpi_type": kpi_type,
                "value": float(r["avg_value"]),
            })
        logging.info("/api/kpi/query 성공: rows=%d (proxy-db)", len(data))
        return {"data": data, "source": "proxy-db"}
    except Exception:
        # 실패 시 mock 으로 폴백하여 프론트 사용성 보장
        start_date = payload.get("start_date")
        end_date = payload.get("end_date")
        kpi_type = payload.get("kpi_type")
        entity_ids = payload.get("entity_ids", "LHK078ML1,LHK078MR1")
        logging.warning("KPI 프록시 실패, mock 데이터로 폴백")
        data = generate_mock_kpi_data(start_date, end_date, kpi_type, entity_ids.split(","))
        logging.info("/api/kpi/query 폴백 성공: rows=%d (proxy-mock)", len(data))
        return {"data": data, "source": "proxy-mock"}

@app.get("/api/kpi/statistics")
async def get_kpi_statistics(
    start_date: str = Query(..., description="시작 날짜 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="종료 날짜 (YYYY-MM-DD)"),
    kpi_type: str = Query(..., description="KPI 타입"),
    entity_ids: str = Query("LHK078ML1,LHK078MR1", description="엔티티 ID 목록 (쉼표로 구분)"),
    interval_minutes: int = Query(60, ge=1, le=60*24, description="샘플링 간격(분). 최소 5/15 등의 간격 지원")
):
    logging.info("GET /api/kpi/statistics: kpi_type=%s, ids=%s, interval=%s, 기간=%s~%s", kpi_type, entity_ids, interval_minutes, start_date, end_date)
    entity_list = entity_ids.split(",")
    data = generate_mock_kpi_data(start_date, end_date, kpi_type, entity_list, interval_minutes=interval_minutes)
    logging.info("/api/kpi/statistics 응답 rows=%d", len(data))
    return {"data": data}

@app.get("/api/kpi/trends")
async def get_kpi_trends(
    start_date: str = Query(..., description="시작 날짜 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="종료 날짜 (YYYY-MM-DD)"),
    kpi_type: str = Query(..., description="KPI 타입"),
    entity_id: str = Query(..., description="엔티티 ID"),
    interval_minutes: int = Query(60, ge=1, le=60*24, description="샘플링 간격(분)")
):
    logging.info("GET /api/kpi/trends: kpi_type=%s, entity_id=%s, interval=%s, 기간=%s~%s", kpi_type, entity_id, interval_minutes, start_date, end_date)
    data = generate_mock_kpi_data(start_date, end_date, kpi_type, [entity_id], interval_minutes=interval_minutes)
    logging.info("/api/kpi/trends 응답 rows=%d", len(data))
    return {"data": data}

@app.post("/api/kpi/statistics/batch")
async def get_kpi_statistics_batch(payload: dict = Body(...)):
    """
    다수 KPI 타입을 한 번에 조회하는 배치 엔드포인트.
    현재 단계에서는 mock 생성기를 사용해 프론트엔드 대량 KPI 차트 표시를 지원한다.

    기대 입력 예시:
    {
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "kpi_types": ["availability","rrc",...],
      "entity_ids": "LHK078ML1,LHK078MR1",
      "interval_minutes": 60
    }
    """
    try:
        start_date = payload.get("start_date")
        end_date = payload.get("end_date")
        kpi_types = payload.get("kpi_types") or []
        entity_ids = payload.get("entity_ids", "LHK078ML1,LHK078MR1")
        interval_minutes = int(payload.get("interval_minutes") or 60)
        if not start_date or not end_date or not kpi_types:
            raise HTTPException(status_code=400, detail="start_date, end_date, kpi_types는 필수입니다")

        entities = [t.strip() for t in str(entity_ids).split(",") if t.strip()]
        result: Dict[str, List[Dict[str, Any]]] = {}
        logging.info("POST /api/kpi/statistics/batch: types=%d, ids=%d, interval=%s, 기간=%s~%s", len(kpi_types), len(entities), interval_minutes, start_date, end_date)
        for kt in kpi_types:
            result[str(kt)] = generate_mock_kpi_data(start_date, end_date, str(kt), entities, interval_minutes=interval_minutes)
        total = sum(len(v) for v in result.values())
        logging.info("/api/kpi/statistics/batch 응답 합계 rows=%d", total)
        return {"data": result, "source": "proxy-mock"}
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("배치 KPI 통계 생성 실패")
        raise HTTPException(status_code=400, detail=f"failed: {e}")

@app.get("/api/reports/summary")
async def get_summary_reports(report_id: Optional[int] = None):
    if report_id:
        report = next((r for r in mock_reports if r.id == report_id), None)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report
    return {"reports": mock_reports}

@app.get("/api/preferences")
async def get_preferences():
    logging.info("GET /api/preferences 호출: count=%d", len(preferences_db))
    return {"preferences": preferences_db}

@app.get("/api/preferences/{preference_id}")
async def get_preference(preference_id: int):
    logging.info("GET /api/preferences/%s 호출", preference_id)
    preference = next((p for p in preferences_db if p.id == preference_id), None)
    if not preference:
        raise HTTPException(status_code=404, detail="Preference not found")
    return preference

@app.post("/api/preferences")
async def create_preference(preference: PreferenceModel):
    logging.info("POST /api/preferences 호출: name=%s", preference.name)
    global preference_counter
    preference.id = preference_counter
    preference_counter += 1
    preferences_db.append(preference)
    return {"id": preference.id, "message": "Preference created successfully"}

@app.put("/api/preferences/{preference_id}")
async def update_preference(preference_id: int, preference: PreferenceModel):
    logging.info("PUT /api/preferences/%s 호출", preference_id)
    existing = next((p for p in preferences_db if p.id == preference_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail="Preference not found")
    
    existing.name = preference.name
    existing.description = preference.description
    existing.config = preference.config
    return {"message": "Preference updated successfully"}

@app.delete("/api/preferences/{preference_id}")
async def delete_preference(preference_id: int):
    logging.info("DELETE /api/preferences/%s 호출", preference_id)
    global preferences_db
    preferences_db = [p for p in preferences_db if p.id != preference_id]
    return {"message": "Preference deleted successfully"}

@app.get("/api/preferences/{preference_id}/derived-pegs")
async def get_preference_derived_pegs(preference_id: int):
    logging.info("GET /api/preferences/%s/derived-pegs 호출", preference_id)
    pref = next((p for p in preferences_db if p.id == preference_id), None)
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")
    derived = (pref.config or {}).get("derived_pegs") or {}
    return {"derived_pegs": derived}

@app.put("/api/preferences/{preference_id}/derived-pegs")
async def update_preference_derived_pegs(preference_id: int, payload: dict = Body(...)):
    logging.info("PUT /api/preferences/%s/derived-pegs 호출", preference_id)
    pref = next((p for p in preferences_db if p.id == preference_id), None)
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")
    if not isinstance(payload.get("derived_pegs"), dict):
        raise HTTPException(status_code=400, detail="derived_pegs must be an object {name: expr}")
    cfg = pref.config or {}
    cfg["derived_pegs"] = payload["derived_pegs"]
    pref.config = cfg
    return {"message": "Derived PEGs updated", "derived_pegs": cfg["derived_pegs"]}

@app.get("/api/master/pegs")
async def get_pegs():
    return {
        "pegs": [
            {"id": "PEG001", "name": "Seoul Central"},
            {"id": "PEG002", "name": "Busan North"},
            {"id": "PEG003", "name": "Daegu West"}
        ]
    }

@app.get("/api/master/cells")
async def get_cells():
    return {
        "cells": [
            {"id": "LHK078ML1", "name": "Seoul-Gangnam-001"},
            {"id": "LHK078MR1", "name": "Seoul-Gangnam-002"},
            {"id": "LHK078ML1_SIMPANGRAMBONGL04", "name": "Seoul-Gangnam-003"}
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

