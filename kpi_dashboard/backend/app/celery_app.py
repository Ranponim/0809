from celery import Celery
import os

CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')

celery_app = Celery(
    'kpi_dashboard',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=['app.tasks']  # We will create app/tasks.py next
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='Asia/Seoul', # Set your desired timezone
    enable_utc=True,
)

if __name__ == '__main__':
    celery_app.start()
