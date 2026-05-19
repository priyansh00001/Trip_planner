import pytest
from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

def test_missing_admin_secret_transport_trigger():
    """Test that missing admin secret returns 401/422 Unauthorized."""
    response = client.post(
        "/api/transport/trigger",
        json={"origin": "Delhi", "destination": "Jaipur"}
    )
    # FastApi will return 422 if the Header is missing, or 401 if logic catches it
    assert response.status_code in [401, 422]

def test_invalid_admin_secret_transport_trigger():
    """Test that wrong admin secret returns 401 Unauthorized."""
    response = client.post(
        "/api/transport/trigger",
        headers={"X-Admin-Secret": "wrong_secret"},
        json={"origin": "Delhi", "destination": "Jaipur"}
    )
    assert response.status_code == 401

def test_scraper_trigger_invalid_secret():
    """Test scraper trigger endpoint with invalid secret."""
    response = client.post(
        "/api/scraper/trigger/jaipur",
        headers={"X-Admin-Secret": "wrong_secret"}
    )
    assert response.status_code == 403

def test_plan_rate_limiting():
    """Test that rate limiting works on /api/plan."""
    payload = {
        "destination": "Goa",
        "start_date": "2025-10-01",
        "end_date": "2025-10-05",
        "budget_usd": 1000,
        "origin_city": "Mumbai",
        "travelers": 2
    }
    
    # We allow 5 requests per minute, so 6th should fail.
    # To not break other tests, we will pass a custom fake IP header.
    headers = {"X-Forwarded-For": "192.168.1.100"}
    
    responses = []
    for _ in range(6):
        res = client.post("/api/plan", json=payload, headers=headers)
        responses.append(res.status_code)
    
    # At least the last one should be 429
    assert 429 in responses

def test_plan_invalid_input_no_stack_trace():
    """Test that invalid input to /api/plan returns 422 without a stack trace."""
    # Negative budget, travelers=0, missing dates
    payload = {
        "destination": "Goa",
        "budget_usd": -500,
        "origin_city": "Mumbai",
        "travelers": 0
    }
    response = client.post("/api/plan", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert "error" in data
    # Ensure it's not leaking internal exceptions
    assert "Traceback" not in str(data)
    assert "File" not in str(data)

def test_compare_destinations_too_many_slugs():
    """Test that destination comparison gracefully handles more than 3 slugs by slicing."""
    response = client.get("/api/destinations/compare?slugs=a,b,c,d,e")
    # API just takes the first 3, so we check if the response doesn't crash
    assert response.status_code == 200

def test_compare_destinations_empty_slugs():
    """Test empty slugs param."""
    response = client.get("/api/destinations/compare?slugs=")
    assert response.status_code == 200
    assert "comparisons" in response.json()

def test_transport_invalid_origin_dest():
    """Test transport with too short origin/dest. (should fail query validation)"""
    response = client.get("/api/transport?origin=A&destination=B")
    assert response.status_code == 422
