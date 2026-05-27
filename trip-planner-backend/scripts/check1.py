import asyncio
from scrapers.transport_scraper import TransportScraper
import logging
logging.basicConfig(level=logging.DEBUG)

async def main():
  s = TransportScraper()
  print('=== Delhi -> Jaipur (short, all modes expected) ===')
  r1 = await s._scrape_pair('Delhi', 'Jaipur')
  modes1 = {}
  for r in r1:
    modes1[r['mode']] = modes1.get(r['mode'], 0) + 1
  print('Results:', modes1)
  print('Sources:', set(r['source'] for r in r1))

  print()
  print('=== Delhi -> Bangalore (long, no cab expected) ===')
  r2 = await s._scrape_pair('Delhi', 'Bangalore')
  modes2 = {}
  for r in r2:
    modes2[r['mode']] = modes2.get(r['mode'], 0) + 1
  print('Results:', modes2)
  print('Sources:', set(r['source'] for r in r2))

  print()
  print('=== Mumbai -> Goa (flight + train + bus all expected) ===')
  r3 = await s._scrape_pair('Mumbai', 'Goa')
  modes3 = {}
  for r in r3:
    modes3[r['mode']] = modes3.get(r['mode'], 0) + 1
  print('Results:', modes3)
  print('Sources:', set(r['source'] for r in r3))

if __name__ == '__main__':
    import sys
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
