import asyncio
from scrapers.google_transport_scraper import GoogleTransportScraper

async def main():
  g = GoogleTransportScraper()
  print('=== FLIGHTS: Delhi->Jaipur ===')
  f = await g.scrape_flights('Delhi', 'Jaipur')
  print(f'Results: {len(f)}')
  if f: print(f'Sample: {f[0]}')

  print('=== TRAINS: Delhi->Jaipur ===')
  t = await g.scrape_trains('Delhi', 'Jaipur')
  print(f'Results: {len(t)}')
  if t: print(f'Sample: {t[0]}')

  print('=== BUS: Delhi->Manali ===')
  b = await g.scrape_buses('Delhi', 'Manali')
  print(f'Results: {len(b)}')
  if b: print(f'Sample: {b[0]}')

if __name__ == "__main__":
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
