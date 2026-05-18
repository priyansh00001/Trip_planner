import pytest
from scrapers.places_opentripmap import PlacesOpenTripMapScraper
from scrapers.hotels_hostelworld import HotelsHostelworldScraper
from scrapers.blogs_thrillophilia import BlogsThrillophiliaScraper
from scrapers.news_aggregator import NewsAggregatorScraper
from scrapers.events_scraper import EventsScraper
from scrapers.scheduler import start_scheduler

TEST_DEST = {
    "id": None, "slug": "jaipur", "name": "Jaipur",
    "lat": 26.9124, "lon": 75.7873, "state": "Rajasthan"
}

@pytest.mark.asyncio
async def test_opentripmap_places():
    scraper = PlacesOpenTripMapScraper()
    result = await scraper.scrape(TEST_DEST)
    assert isinstance(result, list)
    if result:  # only if API key is set
        assert "name" in result[0]
        assert "lat" in result[0]
        assert "category" in result[0]
    print(f"Places found: {len(result)}")

@pytest.mark.asyncio
async def test_hostelworld_hotels():
    scraper = HotelsHostelworldScraper()
    result = await scraper.scrape(TEST_DEST)
    assert isinstance(result, list)
    if result:
        assert "name" in result[0]
        assert "price_min_inr" in result[0]
        assert result[0]["price_min_inr"] > 0
        assert "rating" in result[0]
    print(f"Hotels found: {len(result)}")
    print(f"Sample: {result[0] if result else 'empty'}")

@pytest.mark.asyncio
async def test_thrillophilia_blogs():
    scraper = BlogsThrillophiliaScraper()
    result = await scraper.scrape(TEST_DEST)
    assert isinstance(result, list)
    if result:
        assert "key_tips" in result[0]
        assert "local_insights" in result[0]
        assert isinstance(result[0]["key_tips"], list)
        assert len(result[0]["key_tips"]) > 0
    print(f"Blogs scraped: {len(result)}")

@pytest.mark.asyncio
async def test_news_aggregator():
    scraper = NewsAggregatorScraper()
    result = await scraper.scrape(TEST_DEST)
    assert isinstance(result, list)
    if result:
        assert "title" in result[0]
        assert "severity" in result[0]
        assert "category" in result[0]
        assert result[0]["severity"] in ["info", "warning", "critical"]
    print(f"News items: {len(result)}")

@pytest.mark.asyncio
async def test_events_scraper():
    scraper = EventsScraper()
    result = await scraper.scrape(TEST_DEST)
    assert isinstance(result, list)
    if result:
        assert "name" in result[0]
        assert "event_type" in result[0]
    print(f"Events found: {len(result)}")

def test_scheduler_initializes():
    scheduler = start_scheduler()
    jobs = scheduler.get_jobs()
    assert len(jobs) > 0
    print(f"Registered jobs: {len(jobs)}")
    scheduler.shutdown()

@pytest.mark.asyncio
async def test_base_scraper_error_handling():
    scraper = NewsAggregatorScraper()
    bad_dest = {"id": None, "slug": "xyz123fake",
                "name": "FakePlace", "lat": 0, "lon": 0, "state": ""}
    result = await scraper.run(bad_dest)
    assert result is None or isinstance(result, (list, dict))
    print("Error handling OK \u2014 no crash on bad destination")