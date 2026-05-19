from fastapi.testclient import TestClient
import time
from dotenv import load_dotenv
load_dotenv()

from main import app

client = TestClient(app)

print("=== Test 1: Cached Pair (Delhi -> Jaipur) ===")
response = client.get("/api/transport?origin=Delhi&destination=Jaipur")
print(f"Status: {response.status_code}")
print(response.json())

print("\n=== Test 3: Trigger without auth ===")
response = client.post("/api/transport/trigger", json={"origin": "Delhi", "destination": "Goa"})
print(f"Status: {response.status_code}")
print(response.json())

print("\n=== Test 4: Trigger with auth ===")
response = client.post("/api/transport/trigger", json={"origin": "Delhi", "destination": "Goa"}, headers={"X-Admin-Secret": "yatra-admin-2025"})
print(f"Status: {response.status_code}")
print(response.json())
