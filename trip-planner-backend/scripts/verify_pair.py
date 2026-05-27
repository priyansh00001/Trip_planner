import asyncio
from scrapers.transport_scraper import TransportScraper

async def main():
  s = TransportScraper()
  for origin, dest in [
    ('Delhi', 'Jaipur'),
    ('Mumbai', 'Goa'),
    ('Delhi', 'Bangalore')
  ]:
    results = await s._scrape_pair(origin, dest)
    modes   = {}
    sources = set()
    for r in results:
      modes[r['mode']] = modes.get(r['mode'], 0) + 1
      sources.add(r['source'])
    print(f'{origin}->{dest}: {modes} | sources: {sources}')

if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
