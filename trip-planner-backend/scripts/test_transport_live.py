import asyncio
from scrapers.transport_scraper import TransportScraper

async def main():
    scraper = TransportScraper()
    dest = {
      "name": "Jaipur", "slug": "jaipur",
      "lat": 26.9124, "lon": 75.7873, "state": "Rajasthan"
    }

    print("=== Testing Delhi -> Jaipur ===")
    results = await scraper._scrape_pair("Delhi", "Jaipur")
    print(f"Total records: {len(results)}")

    by_mode = {}
    for r in results:
      by_mode.setdefault(r["mode"], []).append(r)

    for mode, items in by_mode.items():
      print(f"\n{mode.upper()} ({len(items)} options):")
      for item in items[:2]:  # show max 2 per mode
        print(f"  {item['operator']}: "
              f"Rs{item['price_min_inr']}-Rs{item['price_max_inr']} "
              f"| {item.get('duration_minutes','?')} min")

    # Test cab estimate separately
    print("\n=== Cab Estimate ===")
    cab = await scraper._estimate_cab("Delhi", "Jaipur")
    if cab:
      print(f"Cab: Rs{cab['price_min_inr']}-Rs{cab['price_max_inr']}")
    else:
      print("No cab (distance > 800km or calc failed)")

    # Test long distance — should return None for cab
    print("\n=== Long Distance (Delhi -> Kochi) ===")
    cab_long = await scraper._estimate_cab("Delhi", "Kochi")
    print(f"Cab result: {cab_long} (should be None)")

    # Save to DB if records found
    if results:
      print("\n=== Saving to DB ===")
      try:
          await scraper.save_to_db(results, "jaipur")
          print("Saved. Check Supabase transport_options table.")
      except Exception as e:
          print(f"Skipping save (table missing?): {e}")

if __name__ == "__main__":
    import sys
    import os
    # STEP 2 imports test
    print("--- STEP 2: Imports ---")
    try:
        from scrapers.transport_scraper import TransportScraper
        print("OK1: TransportScraper")
        from routers.transport import router
        print("OK2: router")
        from graph.nodes.budget_node import budget_node
        print("OK3: budget_node")
        from core.models import TripRequest
        r=TripRequest(destination='Jaipur',origin_city='Mumbai',start_date='2025-11-01',end_date='2025-11-05',budget_usd=500,travelers=2)
        print("OK4:", r.origin_city)
    except Exception as e:
        print(f"IMPORT FAILED: {e}")
        sys.exit(1)
        
    print("\n--- STEP 3: Live Scrape ---")
    asyncio.run(main())
