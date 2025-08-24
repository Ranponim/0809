from .celery_app import celery_app

@celery_app.task
def add_together(a, b):
    return a + b
