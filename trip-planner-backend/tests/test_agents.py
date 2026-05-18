"""
Agent unit tests - test each agent's fetch() method directly.
"""
import pytest
from core.models import TripRequest
from agents.weather_agent import WeatherAgent
from agents.currency_agent import CurrencyAgent
from agents.places_agent import PlacesAgent
from agents.flight_agent import FlightAgent
from agents.hotel_agent import HotelAgent
from agents.web_search_agent import WebSearchAgent


# Test state dict to use across all tests
TEST_STATE = {
    "request": TripRequest(
        destination="Jaipur",
        start_date="2025-11-01",
        end_date="2025-11-05",
        budget_usd=500,
        origin_city="DEL",
        travelers=2,
        style="mid"
    ),
    "weather": {
        "lat": "26.9124",
        "lon": "75.7873",
        "forecast": {}
    }
}


@pytest.mark.asyncio
async def test_weather_agent():
    """Test weather agent returns forecast data."""
    agent = WeatherAgent()
    result = await agent.fetch(TEST_STATE)

    assert result is not None
    assert "forecast" in result
    assert "lat" in result
    # Check we have some forecast data (7 days)
    if result.get("forecast"):
        assert len(result["forecast"]) > 0
    print(f"Weather result: {result.get('forecast', {}).keys()}")


@pytest.mark.asyncio
async def test_currency_agent():
    """Test currency agent returns exchange rates."""
    agent = CurrencyAgent()
    result = await agent.fetch(TEST_STATE)

    assert result is not None
    assert "rates" in result
    assert "INR" in result["rates"]
    assert result["rates"]["INR"] > 0
    print(f"Currency rates: {result['rates']}")


@pytest.mark.asyncio
async def test_web_search_agent():
    """Test web search agent extracts destination facts."""
    agent = WebSearchAgent()
    result = await agent.fetch(TEST_STATE)

    assert result is not None
    assert "extracted_facts" in result
    # At least one source should have data
    has_data = result.get("ddg_abstract") or result.get("wiki_summary")
    print(f"Web search - has data: {bool(has_data)}, sources: {result.get('sources_used', [])}")


@pytest.mark.asyncio
async def test_places_agent():
    """Test places agent - OPENTRIPMAP_API_KEY is empty so expect graceful fallback."""
    agent = PlacesAgent()
    result = await agent.fetch(TEST_STATE)

    # Should return gracefully even without API key
    assert result is not None
    assert isinstance(result, dict)
    # Either has attractions or has the note about missing key
    print(f"Places result: note={result.get('note', 'none')}")


@pytest.mark.asyncio
async def test_flight_agent():
    """Test flight agent - AVIATIONSTACK_API_KEY is empty so expect fallback."""
    agent = FlightAgent()
    result = await agent.fetch(TEST_STATE)

    # Should return gracefully with fallback
    assert result is not None
    assert isinstance(result, dict)
    # Has route info at minimum
    assert "route" in result
    print(f"Flight result: route={result.get('route')}, note={result.get('note', 'none')[:50]}...")


@pytest.mark.asyncio
async def test_hotel_agent():
    """Test hotel agent returns hotel data."""
    agent = HotelAgent()
    result = await agent.fetch(TEST_STATE)

    assert result is not None
    assert isinstance(result, dict)
    print(f"Hotel result: city={result.get('city')}, hotels={len(result.get('hotels', []))}")