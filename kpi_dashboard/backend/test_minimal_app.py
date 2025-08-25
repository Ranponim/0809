import sys
import os
sys.path.insert(0, '.')

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Create a minimal app
app = FastAPI()

@app.get("/test")
def test_endpoint():
    return {"message": "Test works!"}

@app.get("/")
def root():
    return {"message": "Root works!"}

# Test the minimal app
client = TestClient(app)

print("Testing minimal app...")
response = client.get("/test")
print(f"Minimal app test: {response.status_code} - {response.json()}")

response = client.get("/")
print(f"Minimal app root: {response.status_code} - {response.json()}")

# Now test the main app
print("\nTesting main app...")
try:
    from app.main import app as main_app
    main_client = TestClient(main_app)
    
    response = main_client.get("/")
    print(f"Main app root: {response.status_code} - {response.json()}")
    
    response = main_client.get("/health")
    print(f"Main app health: {response.status_code} - {response.json()}")
    
    response = main_client.get("/api/test-endpoint")
    print(f"Main app test endpoint: {response.status_code} - {response.json()}")
    
except Exception as e:
    print(f"Error testing main app: {e}")
