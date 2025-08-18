"""
마스터 데이터 API 라우터

PEG 목록, Cell 목록 등 기준 정보를 제공하는 API 엔드포인트들을 정의합니다.
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import psycopg2
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..db import get_database
from ..exceptions import DatabaseConnectionException

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/master", tags=["master"])


@router.get("/pegs", response_model=List[Dict[str, Any]])
async def get_pegs(db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    PEG 마스터 데이터 목록을 조회합니다.
    
    Returns:
        List[Dict]: PEG 마스터 데이터 목록
        - peg_name: PEG 이름
        - description: PEG 설명
        - unit: 단위
    """
    try:
        logger.info("PEG 마스터 데이터 조회 시작")
        
        # MongoDB에서 peg_master 컬렉션 조회
        cursor = db.peg_master.find({}, {"_id": 0})  # _id 필드 제외
        pegs = await cursor.to_list(length=None)
        
        logger.info(f"PEG 마스터 데이터 조회 완료: {len(pegs)}개")
        
        # 데이터가 없으면 기본 하드코딩된 PEG 목록 반환
        if not pegs:
            logger.warning("DB에 PEG 마스터 데이터가 없어 기본 목록 반환")
            pegs = [
                {"peg_name": "availability", "description": "가용성", "unit": "%"},
                {"peg_name": "rrc_success_rate", "description": "RRC 성공률", "unit": "%"},
                {"peg_name": "erab_success_rate", "description": "ERAB 성공률", "unit": "%"},
                {"peg_name": "handover_success_rate", "description": "핸드오버 성공률", "unit": "%"},
                {"peg_name": "throughput_dl", "description": "하향 처리량", "unit": "Mbps"},
                {"peg_name": "throughput_ul", "description": "상향 처리량", "unit": "Mbps"}
            ]
        
        return pegs
        
    except Exception as e:
        logger.error(f"PEG 마스터 데이터 조회 오류: {str(e)}")
        raise DatabaseConnectionException(f"PEG 마스터 데이터 조회 실패: {str(e)}")


@router.get("/cells", response_model=List[Dict[str, Any]])
async def get_cells(db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    Cell 마스터 데이터 목록을 조회합니다.
    
    Returns:
        List[Dict]: Cell 마스터 데이터 목록
        - ne: NE 이름
        - cell_id: Cell ID
        - description: Cell 설명
    """
    try:
        logger.info("Cell 마스터 데이터 조회 시작")
        
        # MongoDB에서 cell_master 컬렉션 조회
        cursor = db.cell_master.find({}, {"_id": 0})  # _id 필드 제외
        cells = await cursor.to_list(length=None)
        
        logger.info(f"Cell 마스터 데이터 조회 완료: {len(cells)}개")
        
        # 데이터가 없으면 기본 하드코딩된 Cell 목록 반환
        if not cells:
            logger.warning("DB에 Cell 마스터 데이터가 없어 기본 목록 반환")
            cells = [
                {"ne": "eNB_001", "cell_id": "Cell_001", "description": "1호기 Cell 1"},
                {"ne": "eNB_001", "cell_id": "Cell_002", "description": "1호기 Cell 2"},
                {"ne": "eNB_002", "cell_id": "Cell_001", "description": "2호기 Cell 1"},
                {"ne": "eNB_002", "cell_id": "Cell_002", "description": "2호기 Cell 2"}
            ]
        
        return cells
        
    except Exception as e:
        logger.error(f"Cell 마스터 데이터 조회 오류: {str(e)}")
        raise DatabaseConnectionException(f"Cell 마스터 데이터 조회 실패: {str(e)}")


@router.get("/info")
async def get_master_info():
    """
    마스터 데이터 API 정보를 반환합니다.
    """
    return {
        "service": "Master Data API",
        "version": "1.0.0",
        "endpoints": [
            {"path": "/api/master/pegs", "description": "PEG 마스터 데이터 조회"},
            {"path": "/api/master/cells", "description": "Cell 마스터 데이터 조회"}
        ]
    }


class PostgresConnectionConfig(BaseModel):
    """PostgreSQL 연결 테스트 요청 모델"""
    host: str = Field(..., description="DB Host")
    port: int = Field(default=5432, description="DB Port")
    user: str = Field(default="postgres", description="DB User")
    password: str = Field(default="", description="DB Password")
    dbname: str = Field(default="postgres", description="Database Name")
    table: Optional[str] = Field(default=None, description="존재 여부를 확인할 테이블명(선택)")


@router.post("/test-connection")
async def test_postgres_connection(config: PostgresConnectionConfig) -> Dict[str, Any]:
    """
    PostgreSQL 연결을 테스트합니다.

    요청 본문에 포함된 접속 정보로 DB에 접속해 간단한 쿼리를 수행하고,
    선택적으로 특정 테이블 존재 여부를 확인합니다.
    """
    try:
        logger.info(
            "PostgreSQL 연결 테스트 시작: host=%s port=%s db=%s user=%s",
            config.host, config.port, config.dbname, config.user,
        )

        conn = psycopg2.connect(
            host=config.host,
            port=config.port,
            user=config.user,
            password=config.password,
            dbname=config.dbname,
            connect_timeout=5,
        )
        cur = conn.cursor()
        cur.execute("SELECT 1")
        _ = cur.fetchone()

        table_exists: Optional[bool] = None
        if config.table:
            # PostgreSQL에서 테이블 존재 여부 확인
            cur.execute("SELECT to_regclass(%s)", (config.table,))
            table_exists = cur.fetchone()[0] is not None

        cur.close()
        conn.close()

        return {
            "success": True,
            "message": "Connection successful",
            "table_exists": table_exists,
        }
    except Exception as e:
        logger.error("PostgreSQL 연결 실패: %s", e)
        raise HTTPException(status_code=400, detail=f"Connection failed: {e}")
