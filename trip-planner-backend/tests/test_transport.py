import os
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app
from core.models import TripRequest
from graph.state import TripState
from graph.nodes.budget_node import budget_node

client = TestClient(app)

@pytest.fixture
def mock_db():
    with patch("routers.transport.db") as mock:
        class MockTable:
            def __init__(self, name):
                self.name = name
            def select(self, *args, **kwargs): return self
            def eq(self, *args, **kwargs): return self
            def order(self, *args, **kwargs): return self
            def upsert(self, *args, **kwargs): return self
            def execute(self):
                if self.name == "city_pairs_index":
                    # We can customize this per test if needed, but a default works
                    return MagicMock(data=[{
                        "origin_slug": "mumbai",
                        "destination_slug": "jaipur",
                        "last_scraped": "2026-05-19T10:00:00+00:00",
                        "scrape_status": "done"
                    }])
                elif self.name == "transport_options":
                    return MagicMock(data=[
                        {
                            "mode": "flight",
                            "operator": "IndiGo",
                            "price_min_inr": 4000,
                            "price_max_inr": 5000,
                            "duration_minutes": 120,
                            "departure_times": ["08:00"],
                            "frequency": "Daily",
                            "booking_url": "https://indigo.in",
                            "source": "ixigo",
                            "scraped_at": "2026-05-19T10:00:00Z"
                        }
                    ])
                return MagicMock(data=[])

        mock.table.side_effect = lambda name: MockTable(name)
        yield mock

@pytest.fixture
def mock_scraper():
    with patch("routers.transport.TransportScraper") as mock:
        instance = mock.return_value
        instance._scrape_pair = MagicMock(return_value=[])
        instance.save_to_db = MagicMock(return_value=None)
        yield mock

def test_trigger_transport_unauthorized(mock_scraper):
    response = client.post(
        "/api/transport/trigger",
        json={"origin": "Mumbai", "destination": "Jaipur"},
        headers={"X-Admin-Secret": "wrong_secret"}
    )
    assert response.status_code == 401

@patch.dict(os.environ, {"ADMIN_SECRET": "test_secret"})
def test_trigger_transport_authorized(mock_db, mock_scraper):
    response = client.post(
        "/api/transport/trigger",
        json={"origin": "Mumbai", "destination": "Jaipur"},
        headers={"X-Admin-Secret": "test_secret"}
    )
    assert response.status_code == 202
    assert response.json() == {"message": "Scraping triggered successfully"}

def test_get_transport_fresh(mock_db):
    response = client.get("/api/transport?origin=Mumbai&destination=Jaipur")
    assert response.status_code == 200
    data = response.json()
    assert data["origin"] == "Mumbai"
    assert data["destination"] == "Jaipur"
    assert data["scraping_in_progress"] is False
    assert len(data["options"]["flight"]) == 1
    assert data["options"]["flight"][0]["operator"] == "IndiGo"
    assert data["options"]["flight"][0]["price_min_inr"] == 4000

def test_get_transport_stale_triggers_scraping(mock_db, mock_scraper):
    class StaleMockTable:
        def __init__(self, name):
            self.name = name
        def select(self, *args, **kwargs): return self
        def eq(self, *args, **kwargs): return self
        def order(self, *args, **kwargs): return self
        def upsert(self, *args, **kwargs): return self
        def execute(self):
            return MagicMock(data=[])

    mock_db.table.side_effect = lambda name: StaleMockTable(name)

    response = client.get("/api/transport?origin=Mumbai&destination=Jaipur")
    assert response.status_code == 200
    data = response.json()
    assert data["scraping_in_progress"] is True
    assert "background" in data["message"].lower()

@pytest.mark.asyncio
async def test_budget_node_calculation():
    req = TripRequest(
        destination="Jaipur",
        start_date="2025-11-01",
        end_date="2025-11-05",
        budget_usd=500,
        origin_city="Delhi",
        travelers=2,
        style="mid"
    )
    
    state = {
        "request": req,
        "itinerary": {
            "days": [
                {
                    "day_number": 1,
                    "hotel": {"estimated_cost_inr": 2000},
                    "activities": [{"costEstimate": "₹500"}]
                },
                {
                    "day_number": 2,
                    "hotel": {"estimated_cost_inr": 2000},
                    "activities": [{"costEstimate": "₹300"}]
                }
            ]
        },
        "retrieved_context": None,
        "transport_cost_inr": 3000, # Per person, round trip cost will be 3000 * 2
        "warnings": []
    }

    result = await budget_node(state)
    breakdown = result["budget_breakdown"]

    assert breakdown["transport_to_destination_inr"] == 3000
    assert breakdown["transport_return_inr"] == 3000
    assert breakdown["accommodation_inr"] == 4000 # 2000 * 2 days
    assert breakdown["activities_inr"] == 800 # 500 + 300
    
    # original_budget in INR = 500 * 83 = 41500
    # transport total = 3000 * 2 = 6000
    assert breakdown["remaining_for_trip_inr"] == 35500 # 41500 - 6000
