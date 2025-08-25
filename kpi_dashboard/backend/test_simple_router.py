import sys
import os
sys.path.insert(0, '.')

from app.main import app

print("Testing router registration...")

# Check if the router is registered
for route in app.routes:
    if hasattr(route, 'path'):
        print(f"Route: {route.path}")
        if hasattr(route, 'methods'):
            print(f"  Methods: {route.methods}")
        if hasattr(route, 'name'):
            print(f"  Name: {route.name}")
        print()

# Check specifically for analysis_workflow routes
print("Looking for analysis_workflow routes...")
for route in app.routes:
    if hasattr(route, 'path') and '/api/analyze' in route.path:
        print(f"Found analysis route: {route.path}")
        if hasattr(route, 'methods'):
            print(f"  Methods: {route.methods}")
        if hasattr(route, 'name'):
            print(f"  Name: {route.name}")
        print()
