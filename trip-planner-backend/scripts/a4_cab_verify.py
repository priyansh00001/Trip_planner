"""A4 -- Cab estimate haversine verification for known city pairs."""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrapers.transport_scraper import TransportScraper

async def main():
    scraper = TransportScraper()
    pairs = [
        ('Delhi',   'Jaipur',   280),
        ('Mumbai',  'Pune',     150),
        ('Delhi',   'Agra',     210),
        ('Mumbai',  'Goa',      590),
        ('Delhi',   'Kochi',    2800),
        ('Chennai', 'Bangalore', 350),
    ]
    for origin, dest, expected_km in pairs:
        result = await scraper._estimate_cab(origin, dest)
        if result:
            price = f"INR {result['price_min_inr']}-{result['price_max_inr']}"
            dur   = result.get('duration_minutes', '?')
            print(f'{origin}->{dest}: {price} | {dur}min | expected ~{expected_km}km')
        else:
            print(f'{origin}->{dest}: None (too far or calc failed) | expected ~{expected_km}km')
        # Rate limit for Nominatim
        await asyncio.sleep(1.5)

asyncio.run(main())
