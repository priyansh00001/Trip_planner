import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from scrapers.transport_seed import get_seed_options, SEED_DATA
from scrapers.transport_scraper import TransportScraper

async def main():
  scraper = TransportScraper()
  total   = 0

  all_pairs = list(SEED_DATA.keys())
  print(f"Seeding {len(all_pairs)} city pairs...")

  for origin, destination in all_pairs:
    options = get_seed_options(origin, destination)
    if options:
      await scraper.save_to_db(
        options,
        destination.lower().replace(" ", "-")
      )
      total += len(options)
      print(
        f"  {origin}->{destination}: "
        f"{len(options)} options seeded"
      )
    await asyncio.sleep(0.5)

  print(f"\nDone. Total records seeded: {total}")
  print("Run transport scraper to replace with live data over time.")

if __name__ == "__main__":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
