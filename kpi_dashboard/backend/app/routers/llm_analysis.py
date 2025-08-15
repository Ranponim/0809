"""
LLM 분석 API 라우터

MCP analysis_llm.py와 연동하여 LLM 기반 분석을 수행합니다.
"""

import json
import logging
import uuid
import os
from datetime import datetime
from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

import requests
from ..db import get_database
from ..models.analysis import AnalysisResultCreate, AnalysisResultModel, AnalysisResultBase

# 라우터 및 로거 설정
router = APIRouter()
logger = logging.getLogger(__name__)


class MongoJSONEncoder(json.JSONEncoder):
    """MongoDB ObjectId를 JSON으로 직렬화하기 위한 커스텀 인코더"""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)


@router.post("/api/analysis/trigger-llm-analysis", response_model=Dict[str, str], status_code=status.HTTP_202_ACCEPTED)
async def trigger_llm_analysis(
    request_data: Dict[str, Any],
    background_tasks: BackgroundTasks
):
    """
    LLM 분석을 트리거합니다.
    
    Request body should contain:
    - db_config: PostgreSQL 연결 정보
    - n_minus_1: 이전 기간 (e.g., "2025-01-01_00:00~2025-01-01_23:59")
    - n: 현재 기간 (e.g., "2025-01-02_00:00~2025-01-02_23:59")
    - enable_mock: 테스트 모드 여부
    """
    try:
        # 분석 ID 생성
        analysis_id = str(uuid.uuid4())
        
        logger.info(f"LLM 분석 요청 시작: {analysis_id}")
        logger.info(f"요청 데이터: {request_data}")
        
        # 분석 상태를 MongoDB에 먼저 저장
        db = get_database()
        initial_result = AnalysisResultCreate(
            analysis_id=analysis_id,
            analysis_type="llm_analysis",
            status="processing",
            analysis_date=datetime.utcnow(),
            request_params=request_data,
            results=[]
        )
        
        await db.analysis_results.insert_one(initial_result.dict())

        # 사용자 Preference에서 DB 설정을 조회하여 주입 (요청값이 있으면 병합/덮어쓰기)
        user_id = request_data.get("user_id", "default")
        pref = await db.user_preferences.find_one({"user_id": user_id})
        pref_db = (pref or {}).get("database_settings", {})
        # 요청의 db_config가 있으면 요청값 우선, 없으면 preference 사용
        request_db_config = request_data.get("db_config") or {}
        effective_db_config = {
            "host": request_db_config.get("host", pref_db.get("host")),
            "port": request_db_config.get("port", pref_db.get("port", 5432)),
            "user": request_db_config.get("user", pref_db.get("user", "postgres")),
            "password": request_db_config.get("password", pref_db.get("password")),
            "dbname": request_db_config.get("dbname", pref_db.get("dbname", "postgres")),
            "table": request_data.get("table") or pref_db.get("table", "summary"),
        }

        # 백그라운드에서 LLM 분석 실행
        background_tasks.add_task(
            execute_llm_analysis,
            analysis_id,
            effective_db_config,
            request_data.get("n_minus_1", ""),
            request_data.get("n", ""),
            request_data.get("enable_mock", False)
        )
        
        return {
            "status": "triggered",
            "analysis_id": analysis_id,
            "message": "LLM 분석이 시작되었습니다. 잠시 후 결과를 확인할 수 있습니다."
        }
        
    except Exception as e:
        logger.exception(f"LLM 분석 트리거 실패: {e}")
        raise HTTPException(status_code=500, detail=f"분석 요청 처리 중 오류 발생: {str(e)}")


async def execute_llm_analysis(
    analysis_id: str,
    db_config: Dict[str, Any],
    n_minus_1: str,
    n: str,
    enable_mock: bool
):
    """
    백그라운드에서 LLM 분석을 실행하고 결과를 MongoDB에 저장합니다.
    """
    try:
        logger.info(f"LLM 분석 실행 시작: {analysis_id}")

        analysis_result: Dict[str, Any] | None = None

        # 실제 MCP API 호출 (환경변수 설정 시, enable_mock=False일 때만)
        if not enable_mock:
            mcp_url = os.getenv("MCP_ANALYZER_URL")
            mcp_api_key = os.getenv("MCP_API_KEY")
            try:
                if mcp_url:
                    logger.info(f"MCP 호출 시도: {mcp_url}")
                    payload = {
                        "db": db_config,
                        "n_minus_1": n_minus_1,
                        "n": n
                    }
                    headers = {"Content-Type": "application/json"}
                    if mcp_api_key:
                        headers["Authorization"] = f"Bearer {mcp_api_key}"
                    resp = requests.post(mcp_url, json=payload, headers=headers, timeout=60)
                    resp.raise_for_status()
                    analysis_result = resp.json()
                    logger.info("MCP 실제 분석 결과 수신 완료")
                else:
                    logger.warning("MCP_ANALYZER_URL 미설정. Mock으로 폴백합니다.")
            except Exception as e:
                logger.exception(f"MCP 호출 실패. Mock으로 폴백: {e}")
                analysis_result = None

        # MCP는 별도 환경. 실제 호출이 없거나 실패한 경우 Mock 결과 생성
        if analysis_result is None:
            analysis_result = {
                "status": "success",
                "message": "MCP 연동이 필요합니다. 현재는 Mock 데이터입니다.",
                "analysis_date": datetime.utcnow().isoformat(),
                "results": [
                    {
                        "status": "completed",
                        "message": "Mock LLM 분석 결과입니다.",
                        "analysis_date": datetime.utcnow().isoformat(),
                        "mock_data": True,
                        "executive_summary": "셀 성능이 전반적으로 양호합니다.",
                        "average_score": 97.7,
                        "score_formula": "가중 평균 = Σ(PEG값 × 가중치) / Σ(가중치)",
                        "analysis_info": {
                            "host": db_config.get("host") or "postgresql.example.com",
                            "version": "5G NR v1.2.3",
                            "ne": "MOCK_NE_001",
                            "cellid": "MOCK_CELL_001"
                        },
                        "kpi_results": [
                        {"peg_name": "DL PDSCH Throughput", "weight": 10, "n_minus_1": 95.5, "n": 98.2, "unit": "Mbps", "peg": 1},
                        {"peg_name": "UL PUSCH Throughput", "weight": 10, "n_minus_1": 87.3, "n": 89.1, "unit": "Mbps", "peg": 2},
                        {"peg_name": "RRC Setup Success Rate", "weight": 9.5, "n_minus_1": 98.1, "n": 98.8, "unit": "%", "peg": 3},
                        {"peg_name": "E2E Latency (UE-Core)", "weight": 9.5, "n_minus_1": 12.3, "n": 11.8, "unit": "ms", "peg": 4},
                        {"peg_name": "Intra-Freq Handover Success Rate", "weight": 9, "n_minus_1": 96.7, "n": 97.2, "unit": "%", "peg": 5},
                        {"peg_name": "PDCP Packet Loss Rate", "weight": 9, "n_minus_1": 0.15, "n": 0.12, "unit": "%", "peg": 6},
                        {"peg_name": "DL SINR", "weight": 8.5, "n_minus_1": 18.5, "n": 19.2, "unit": "dB", "peg": 7},
                        {"peg_name": "PDSCH BLER", "weight": 8.5, "n_minus_1": 2.3, "n": 1.8, "unit": "%", "peg": 8},
                        {"peg_name": "PRB Utilization Rate", "weight": 8, "n_minus_1": 75.5, "n": 78.2, "unit": "%", "peg": 9},
                        {"peg_name": "UE Connection Density", "weight": 8, "n_minus_1": 89, "n": 92, "unit": "UEs/cell", "peg": 10},
                        {"peg_name": "MAC DL Throughput", "weight": 8, "n_minus_1": 92.3, "n": 95.1, "unit": "Mbps", "peg": 11},
                        {"peg_name": "HARQ Retransmission Rate", "weight": 7, "n_minus_1": 3.5, "n": 2.8, "unit": "%", "peg": 12},
                        {"peg_name": "CSI-RSRP", "weight": 7.5, "n_minus_1": -85.2, "n": -82.1, "unit": "dBm", "peg": 13},
                        {"peg_name": "Beam Failure Recovery Time", "weight": 7.5, "n_minus_1": 45.3, "n": 42.1, "unit": "ms", "peg": 14},
                        {"peg_name": "VoNR Call Drop Rate", "weight": 7.5, "n_minus_1": 0.25, "n": 0.18, "unit": "%", "peg": 15},
                        {"peg_name": "QoS Flow Success Rate", "weight": 7, "n_minus_1": 97.8, "n": 98.3, "unit": "%", "peg": 16},
                        {"peg_name": "PDU Session Setup Time", "weight": 7, "n_minus_1": 85.5, "n": 78.2, "unit": "ms", "peg": 17},
                        {"peg_name": "UL Interference Noise", "weight": 7.5, "n_minus_1": -108.5, "n": -110.2, "unit": "dB", "peg": 18},
                        {"peg_name": "Radio Link Failure (RLF) Rate", "weight": 7.5, "n_minus_1": 0.35, "n": 0.28, "unit": "%", "peg": 19},
                        {"peg_name": "Energy Efficiency (Watt/Gbps)", "weight": 6.5, "n_minus_1": 125.3, "n": 118.7, "unit": "Watt/Gbps", "peg": 20}
                        ]
                    }
                ],
                "mock_data": True,
                "source_metadata": {
                    "ne_id": "MOCK_NE_001",
                    "cell_id": "MOCK_CELL_001",
                    "schema_info": {
                        "id": "auto_increment_integer",
                        "datetime": "timestamp",
                        "value": "double_precision",
                        "version": "text",
                        "family_name": "text",
                        "cellid": "text",
                        "peg_name": "text",
                        "host": "text",
                        "ne": "text"
                    },
                    "db_config": db_config,
                    "time_ranges": {"n_minus_1": n_minus_1, "n": n}
                }
            }

        logger.info(f"임시 Mock 결과 생성: {analysis_id}")

        # MongoDB 상태 업데이트 - 원본 스키마 정보 포함
        db = get_database()
        source_meta = analysis_result.get("source_metadata", {})
        
        await db.analysis_results.update_one(
            {"analysis_id": analysis_id},
            {
                "$set": {
                    "status": "completed" if analysis_result.get("status") == "success" else "error",
                    "results": analysis_result,
                    "completed_at": datetime.utcnow(),
                    # 원본 PostgreSQL 스키마에서 추출한 정보 추가
                    "ne_id": source_meta.get("ne_id"),
                    "cell_id": source_meta.get("cell_id"),
                    "source_metadata": source_meta
                }
            }
        )
        
        logger.info(f"LLM 분석 처리 완료: {analysis_id}")
        
    except Exception as e:
        logger.exception(f"LLM 분석 실행 오류: {analysis_id}, {e}")
        await update_analysis_error(analysis_id, str(e))


async def update_analysis_error(analysis_id: str, error_message: str):
    """분석 오류 상태 업데이트"""
    try:
        db = get_database()
        await db.analysis_results.update_one(
            {"analysis_id": analysis_id},
            {
                "$set": {
                    "status": "error",
                    "error_message": error_message,
                    "completed_at": datetime.utcnow()
                }
            }
        )
    except Exception as e:
        logger.exception(f"Error updating analysis error status: {e}")


@router.get("/api/analysis/llm-analysis/{analysis_id}", response_model=AnalysisResultModel)
async def get_llm_analysis_result(analysis_id: str):
    """특정 LLM 분석 결과를 조회합니다."""
    try:
        db = get_database()
        result = await db.analysis_results.find_one({"analysis_id": analysis_id})
        
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis result not found")
        
        # ObjectId를 문자열로 변환
        if '_id' in result:
            result['_id'] = str(result['_id'])
        
        # results 필드가 dict인 경우 list로 변환 (Pydantic 호환성)
        if 'results' in result and isinstance(result['results'], dict):
            result['results'] = [result['results']]
        
        return AnalysisResultModel(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"LLM 분석 결과 조회 오류: {analysis_id}, {e}")
        raise HTTPException(status_code=500, detail=f"분석 결과 조회 중 오류 발생: {str(e)}")