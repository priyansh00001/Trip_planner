import asyncio
from scrapers.news_aggregator import NewsAggregatorScraper
import sys
async def main():
    scraper = NewsAggregatorScraper()
    bad_dest = {"id": None, "slug": "xyz123fake", "name": "FakePlace", "lat": 0, "lon": 0, "state": ""}
    try:
        res = await scraper.run(bad_dest)
        print("TYPE IS:", type(res))
        print("VALUE IS:", res)
    except Exception as e:
        print("EXCEPTION:", type(e), e)
if __name__ == "__main__":
    asyncio.run(main())
