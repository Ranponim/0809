import os
import time
import logging
from pymongo import MongoClient


logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


def get_mongo_url():
    """환경변수에서 Mongo URL을 가져옵니다."""
    return os.getenv("MONGO_URL", "mongodb://mongo:27017")


def wait_for_db(max_attempts: int = 30, sleep_seconds: float = 1.0) -> None:
    """MongoDB 접속 가능할 때까지 대기합니다."""
    mongo_url = get_mongo_url()
    for attempt in range(1, max_attempts + 1):
        try:
            logging.info("Mongo 연결 확인 %d/%d: %s", attempt, max_attempts, mongo_url)
            client = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
            client.admin.command("ping")
            logging.info("Mongo 연결 성공")
            return
        except Exception as e:
            logging.warning("Mongo 연결 대기 중: %s", e)
            time.sleep(sleep_seconds)
    raise RuntimeError("Mongo 준비 대기 시간 초과")


if __name__ == "__main__":
    wait_for_db()


