"""
마스터 데이터 API 라우터

PEG 목록, Cell 목록 등 기준 정보를 제공하는 API 엔드포인트들을 정의합니다.
"""

import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
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
