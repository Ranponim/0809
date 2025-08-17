import os
import logging
from datetime import datetime
from typing import List, Dict, Any
import psycopg2
import psycopg2.extras
from contextlib import contextmanager

logger = logging.getLogger(__name__)

def get_db_connection_details():
    """
    환경 변수 또는 기본값에서 DB 연결 정보를 가져옵니다.
    """
    return {
        "host": os.getenv("DB_HOST", "127.0.0.1"),
        "port": os.getenv("DB_PORT", 5432),
        "user": os.getenv("DB_USER", "postgres"),
        "password": os.getenv("DB_PASSWORD", "pass"),
        "dbname": os.getenv("DB_NAME", "netperf"),
    }

@contextmanager
def get_db_connection():
    """
    PostgreSQL 데이터베이스 연결을 위한 컨텍스트 관리자를 제공합니다.
    """
    conn = None
    try:
        db_details = get_db_connection_details()
        conn = psycopg2.connect(**db_details)
        logger.info(f"PostgreSQL DB 연결 성공: host={db_details['host']}, dbname={db_details['dbname']}")
        yield conn
    except psycopg2.OperationalError as e:
        logger.error(f"PostgreSQL DB 연결 실패: {e}")
        raise
    finally:
        if conn:
            conn.close()
            logger.info("PostgreSQL DB 연결 종료")

def query_kpi_data(
    start_date: str,
    end_date: str,
    kpi_types: List[str],
    ne_filters: List[str] = None,
    cellid_filters: List[str] = None,
) -> Dict[str, List[Dict[str, Any]]]:
    """
    PostgreSQL에서 여러 KPI에 대한 시계열 데이터를 조회합니다.
    """
    logger.info(f"PostgreSQL KPI 데이터 조회 시작: {len(kpi_types)}개 KPI")

    # entity_id 대신 ne, cellid를 사용하고, kpi_type 대신 peg_name을 사용합니다.
    # 테이블 스키마는 analysis_llm.py를 참조하여 가정합니다.
    # 테이블: summary, 컬럼: datetime, peg_name, value, ne, cellid

    query = """
        SELECT
            datetime as timestamp,
            ne || '#' || cellid as entity_id,
            peg_name as kpi_type,
            peg_name,
            value,
            ne,
            cellid as cell_id,
            to_char(datetime, 'YYYY-MM-DD') as date,
            extract(hour from datetime) as hour
        FROM
            summary
        WHERE
            datetime BETWEEN %s AND %s
            AND peg_name = ANY(%s)
    """

    params = [start_date, end_date, kpi_types]

    if ne_filters:
        query += " AND ne = ANY(%s)"
        params.append(ne_filters)

    if cellid_filters:
        query += " AND cellid = ANY(%s)"
        params.append(cellid_filters)

    query += " ORDER BY datetime ASC;"

    data_by_kpi = {kpi: [] for kpi in kpi_types}

    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(query, tuple(params))
                rows = cur.fetchall()

                for row in rows:
                    row_dict = dict(row)
                    # datetime 객체를 ISO 8601 형식의 문자열로 변환
                    if isinstance(row_dict.get('timestamp'), datetime):
                        row_dict['timestamp'] = row_dict['timestamp'].isoformat()

                    kpi_type = row_dict['kpi_type']
                    if kpi_type in data_by_kpi:
                        data_by_kpi[kpi_type].append(row_dict)

        logger.info(f"PostgreSQL 조회 완료: {sum(len(v) for v in data_by_kpi.values())}개 레코드")
        return data_by_kpi

    except Exception as e:
        logger.error(f"PostgreSQL KPI 데이터 조회 중 오류 발생: {e}", exc_info=True)
        # 오류 발생 시 빈 데이터를 반환하여 API가 중단되지 않도록 함
        return data_by_kpi
