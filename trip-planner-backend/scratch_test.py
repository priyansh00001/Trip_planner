import asyncio
import json
import logging
from pprint import pprint

# Set up basic logging to see if scrapers are doing things
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

import sys
sys.stdout = open("output.txt", "w", encoding="utf-8")

from scrapers.places_opentripmap import PlacesOpenTripMapScraper
from scrapers.hotels_hostelworld import HotelsHostelworldScraper
from scrapers.blogs_thrillophilia import BlogsThrillophiliaScraper
from scrapers.news_aggregator import NewsAggregatorScraper
from scrapers.events_scraper import EventsScraper

TEST_DEST = {
    "id": None, "slug": "jaipur", "name": "Jaipur",
    "lat": 26.9124, "lon": 75.7873, "state": "Rajasthan"
}

async def test_scraper(name, scraper_class):
    print(f"\n{'='*50}\nTesting {name}...\n{'='*50}")
    scraper = scraper_class()
    try:
        # We use .scrape() to get the raw list of items, rather than .run() which writes to DB
        result = await scraper.scrape(TEST_DEST)
        print(f"\n[SUCCESS] {name} returned {len(result)} items.")
        if result:
            print(f"Sample data from {name}:")
            pprint(result[0])
        else:
            print(f"[INFO] {name} returned an empty list. This may be due to missing API keys or no data found.")
    except Exception as e:
        print(f"\n[ERROR] {name} failed with exception: {e}")
        import traceback
        traceback.print_exc()

async def main():
    print("Starting comprehensive scraper tests...")
    
    # Run Hostelworld last as Playwright might take a while
    print("\nStarting Hostelworld (Playwright)... This may take up to a minute to launch a browser and scrape.")
    await test_scraper("HotelsHostelworldScraper", HotelsHostelworldScraper)
    
    print("\nAll tests completed.")

if __name__ == "__main__":
    asyncio.run(main())
