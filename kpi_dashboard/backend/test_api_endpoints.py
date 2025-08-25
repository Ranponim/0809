#!/usr/bin/env python3
"""
Simple API endpoint test script
"""

import requests
import json

def test_api_endpoints():
    base_url = "http://localhost:8000"
    
    # Test health endpoint
    print("Testing health endpoint...")
    response = requests.get(f"{base_url}/health")
    print(f"Health status: {response.status_code}")
    if response.status_code == 200:
        print("✅ Health endpoint works")
    else:
        print("❌ Health endpoint failed")
    
    # Test analyze endpoint
    print("\nTesting analyze endpoint...")
    test_data = {
        "start_date": "2025-08-24",
        "end_date": "2025-08-25",
        "analysis_type": "kpi_comparison",
        "parameters": {
            "metrics": ["kpi_value"]
        }
    }
    
    response = requests.post(
        f"{base_url}/api/analyze/",
        json=test_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Analyze endpoint status: {response.status_code}")
    if response.status_code == 200:
        print("✅ Analyze endpoint works")
        print(f"Response: {response.json()}")
    else:
        print("❌ Analyze endpoint failed")
        print(f"Response: {response.text}")
    
    # Test available endpoints
    print("\nTesting available endpoints...")
    endpoints = [
        "/",
        "/health",
        "/api/analyze/",
        "/api/statistical-comparison/",
        "/api/integrated-analysis/",
        "/api/anomaly-detection/",
        "/api/period-identification/"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}")
            print(f"{endpoint}: {response.status_code}")
        except Exception as e:
            print(f"{endpoint}: Error - {e}")

if __name__ == "__main__":
    test_api_endpoints()
