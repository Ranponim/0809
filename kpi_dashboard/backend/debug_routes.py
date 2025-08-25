#!/usr/bin/env python3
"""
Debug script to check route registration
"""

import uvicorn
from fastapi import FastAPI
from app.main import app

def debug_routes():
    """Print all registered routes"""
    print("🔍 Debugging FastAPI routes...")
    print("=" * 50)
    
    # Print all routes
    for route in app.routes:
        if hasattr(route, 'path'):
            print(f"Route: {route.path}")
            if hasattr(route, 'methods'):
                print(f"  Methods: {route.methods}")
            if hasattr(route, 'name'):
                print(f"  Name: {route.name}")
            print()
    
    # Print specific routes we're looking for
    print("🔍 Looking for specific routes...")
    target_routes = [
        "/api/analyze/",
        "/api/statistical-comparison/",
        "/api/integrated-analysis/",
        "/api/anomaly-detection/",
        "/api/period-identification/"
    ]
    
    for target in target_routes:
        found = False
        for route in app.routes:
            if hasattr(route, 'path') and route.path == target:
                print(f"✅ Found: {target}")
                found = True
                break
        if not found:
            print(f"❌ Not found: {target}")
    
    print("\n🔍 Router prefixes...")
    for route in app.routes:
        if hasattr(route, 'prefix') and route.prefix:
            print(f"Prefix: {route.prefix}")

if __name__ == "__main__":
    debug_routes()
