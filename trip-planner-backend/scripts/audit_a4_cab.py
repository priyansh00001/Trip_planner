"""A4 — Cab Haversine Verification"""
import asyncio
from scrapers.transport_scraper import TransportScraper

PAIRS = [
    ("Delhi",   "Jaipur",    280),
    ("Mumbai",  "Pune",      150),
    ("Delhi",   "Agra",      210),
    ("Mumbai",  "Goa",       590),
    ("Delhi",   "Kochi",     2800),
    ("Chennai", "Bangalore", 350),
]

async def main():
    scraper = TransportScraper()
    for origin, dest, expected_km in PAIRS:
        result = await scraper._estimate_cab(origin, dest)
        if result:
            pmin = result["price_min_inr"]
            pmax = result["price_max_inr"]
            dur  = result.get("duration_minutes", "?")
            print(f"{origin}->{dest}: Rs{pmin}-Rs{pmax} | {dur}min | expected ~{expected_km}km")
        else:
            print(f"{origin}->{dest}: None (too far / fail) | expected ~{expected_km}km")
        await asyncio.sleep(1)  # respect Nominatim rate limit

asyncio.run(main())
