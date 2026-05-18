"""
tests/test_smart_scraper.py

Tests for BrowserAgent, SmartScraper, and OnDemandScraper.
Run with:
  pytest tests/test_smart_scraper.py -v -s --asyncio-mode=auto --timeout=60
"""
import pytest
from scrapers.browser_agent import BrowserAgent
from scrapers.smart_scraper import SmartScraper, ScrapedBundle
from scrapers.on_demand import OnDemandScraper


@pytest.mark.asyncio
async def test_browser_agent_wikipedia():
    """BrowserAgent can navigate Wikipedia and extract structured travel data."""
    agent = BrowserAgent()
    result = await agent.extract_from_url(
        "https://en.wikipedia.org/wiki/Jaipur",
        "Jaipur",
    )
    assert isinstance(result, dict), "Result must be a dict"
    # At least one of the major keys should be present (LLM may not fill all)
    expected_keys = {"places", "local_insights", "events", "best_months",
                     "hotels", "avg_daily_budget_inr"}
    found_keys = set(result.keys()) & expected_keys
    assert len(found_keys) > 0, f"Expected at least one travel key, got: {list(result.keys())}"
    print(f"Extracted keys: {list(result.keys())}")
    if result.get("places"):
        print(f"  Sample place: {result['places'][0]}")
    if result.get("local_insights"):
        print(f"  Sample insight: {result['local_insights'][0]}")


@pytest.mark.asyncio
async def test_browser_agent_cleans_text():
    """_clean_page_text removes boilerplate, deduplicates, and truncates at 8000 chars."""
    agent = BrowserAgent()

    # Build dirty text: 50 short/junk lines + substantial real content
    junk_lines = ["x"] * 50
    real_lines = ["Real content about Jaipur and its famous monuments and culture. "] * 20
    dirty = "\n".join(junk_lines + real_lines)

    clean = agent._clean_page_text(dirty)

    assert len(clean) <= 8000, f"Cleaned text too long: {len(clean)} chars"
    assert "Real content" in clean, "Real content should survive cleaning"
    # Junk 'x' lines should be removed (< 20 chars)
    assert "\nx\n" not in clean and not clean.startswith("x\n"), \
        "Short junk lines should be stripped"
    print(f"Cleaned text length: {len(clean)} chars")


@pytest.mark.asyncio
async def test_smart_scraper_parallel():
    """SmartScraper runs sites in parallel and returns a valid ScrapedBundle."""
    scraper = SmartScraper()
    dest = {
        "name": "Jaipur",
        "slug": "jaipur",
        "lat": 26.9124,
        "lon": 75.7873,
        "state": "Rajasthan",
    }

    # Use max_sites=2 to keep test duration reasonable
    bundle = await scraper.scrape_destination(dest, max_sites=2, timeout_per_site=30)

    assert isinstance(bundle, ScrapedBundle), "Result must be a ScrapedBundle"
    total_attempted = len(bundle.sources_scraped) + len(bundle.sources_failed)
    assert total_attempted >= 1, "At least one site should have been attempted"

    print(f"Scraped from:  {bundle.sources_scraped}")
    print(f"Failed:        {bundle.sources_failed}")
    print(f"Places:        {len(bundle.places)}")
    print(f"Hotels:        {len(bundle.hotels)}")
    print(f"Insights:      {len(bundle.local_insights)}")
    print(f"Events:        {len(bundle.events)}")
    print(f"Best months:   {bundle.best_months}")


@pytest.mark.asyncio
async def test_on_demand_known_city():
    """OnDemandScraper geocodes a valid Indian city and starts background scrape."""
    scraper = OnDemandScraper()
    result = await scraper.handle_unknown_destination("Ziro Valley Arunachal")

    assert result.found is True, "Valid city should be found"
    assert result.destination is not None, "Destination dict should be returned"
    assert result.destination.get("lat") is not None, "Lat should be populated"
    assert result.destination.get("name") is not None, "Name should be populated"

    print(f"Found:           {result.destination['name']}, {result.destination.get('state', '')}")
    print(f"Lat/Lon:         {result.destination['lat']}, {result.destination['lon']}")
    print(f"Scraping started: {result.scraping_in_progress}")
    print(f"Message:         {result.message}")


@pytest.mark.asyncio
async def test_on_demand_fake_location():
    """OnDemandScraper returns found=False for a nonsensical location query."""
    scraper = OnDemandScraper()
    result = await scraper.handle_unknown_destination("xyzabcfakelocation123")

    assert result.found is False, "Fake location should not be found"
    print(f"Message: {result.message}")
