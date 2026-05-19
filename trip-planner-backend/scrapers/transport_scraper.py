import asyncio
import logging
import math
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict

import httpx

from scrapers.base import BaseScraper
from scrapers.browser_agent import BrowserAgent

logger = logging.getLogger(__name__)

def slugify(text: str) -> str:
    return text.lower().replace(" ", "-")

class TransportScraper(BaseScraper):
    source_name = "transport"
    scrape_interval_hours = 12

    MAJOR_CITIES = [
        "Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata",
        "Hyderabad", "Ahmedabad", "Pune", "Jaipur", "Lucknow",
        "Chandigarh", "Bhopal", "Kochi", "Guwahati", "Patna"
    ]

    async def scrape(self, destination: dict) -> list[dict]:
        """Scrape all transport options from all MAJOR_CITIES to destination."""
        results = []
        tasks = [
            self._scrape_pair(city, destination["name"])
            for city in self.MAJOR_CITIES
            if city.lower() != destination["name"].lower()
        ]
        batches = await asyncio.gather(*tasks, return_exceptions=True)
        for batch in batches:
            if isinstance(batch, list):
                results.extend(batch)
        return results

    async def _scrape_pair(self, origin: str, destination: str) -> list[dict]:
        results = []
        flight_task = self._scrape_ixigo_flights(origin, destination)
        train_task  = self._scrape_ixigo_trains(origin, destination)
        bus_task    = self._scrape_redbus(origin, destination)

        flight, train, bus = await asyncio.gather(
            flight_task, train_task, bus_task, return_exceptions=True
        )
        if isinstance(flight, list): results.extend(flight)
        if isinstance(train, list):  results.extend(train)
        if isinstance(bus, list):    results.extend(bus)

        # cab_result is synchronous/blocking but uses httpx synchronously or we can make it async
        # Let's await it to avoid blocking the event loop
        cab_result = await self._estimate_cab(origin, destination)
        if cab_result:
            results.append(cab_result)
            
        return results

    async def _scrape_ixigo_flights(self, origin: str, dest: str) -> list[dict]:
        agent = BrowserAgent()
        travel_date = (date.today() + timedelta(days=30)).strftime("%Y%m%d")
        url = (f"https://www.ixigo.com/search/result/flight"
               f"/{origin}/{dest}/{travel_date}/1/0/0/E/OW")
        raw = await agent.extract_from_url(url, f"{origin} to {dest} flights")
        return self._map_to_schema(raw, origin, dest, "flight", "ixigo")

    async def _scrape_ixigo_trains(self, origin: str, dest: str) -> list[dict]:
        agent = BrowserAgent()
        url = (f"https://www.ixigo.com/train/search/result"
               f"?from={origin}&to={dest}")
        raw = await agent.extract_from_url(url, f"{origin} to {dest} trains")
        return self._map_to_schema(raw, origin, dest, "train", "ixigo")

    async def _scrape_redbus(self, origin: str, dest: str) -> list[dict]:
        agent = BrowserAgent()
        travel_date = (date.today() + timedelta(days=30)).strftime("%d-%b-%Y")
        url = (f"https://www.redbus.in/bus-tickets"
               f"/{origin.lower()}-to-{dest.lower()}"
               f"?fromCityName={origin}&toCityName={dest}"
               f"&doj={travel_date}")
        raw = await agent.extract_from_url(url, f"{origin} to {dest} bus")
        return self._map_to_schema(raw, origin, dest, "bus", "redbus")

    async def _get_coordinates(self, city: str) -> Optional[tuple[float, float]]:
        url = f"https://nominatim.openstreetmap.org/search?q={city}&format=json&limit=1"
        try:
            # use a short timeout and headers to satisfy nominatim
            async with httpx.AsyncClient() as client:
                resp = await client.get(url, headers={"User-Agent": "TripPlannerApp"}, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception as e:
            logger.warning(f"Failed to get coordinates for {city}: {e}")
        return None

    async def _haversine_distance(self, origin: str, dest: str) -> Optional[float]:
        orig_coords = await self._get_coordinates(origin)
        dest_coords = await self._get_coordinates(dest)
        
        if not orig_coords or not dest_coords:
            return None
            
        lat1, lon1 = orig_coords
        lat2, lon2 = dest_coords
        
        R = 6371
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = (math.sin(dLat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    async def _estimate_cab(self, origin: str, dest: str) -> dict | None:
        try:
            dist_km = await self._haversine_distance(origin, dest)
            if dist_km is None or dist_km > 800:
                return None
            price_min = int(dist_km * 12)
            price_max = int(dist_km * 18)
            return {
                "origin_city": origin,
                "destination_city": dest,
                "origin_slug": slugify(origin),
                "destination_slug": slugify(dest),
                "mode": "cab",
                "operator": "Intercity Cab (estimated)",
                "price_min_inr": price_min,
                "price_max_inr": price_max,
                "duration_minutes": int(dist_km / 60 * 60),
                "frequency": "On demand",
                "source": "calculated",
                "scraped_at": datetime.utcnow().isoformat()
            }
        except Exception:
            return None

    def _map_to_schema(self, raw: dict, origin: str, dest: str,
                       mode: str, source: str) -> list[dict]:
        records = []
        for item in raw.get("transport", []):
            price = item.get("price_inr", 0)
            if not price or price <= 0:
                continue
            records.append({
                "origin_city":        origin,
                "destination_city":   dest,
                "origin_slug":        slugify(origin),
                "destination_slug":   slugify(dest),
                "mode":               mode,
                "operator":           item.get("operator", ""),
                "duration_minutes":   item.get("duration_minutes"),
                "price_min_inr":      int(price * 0.9),
                "price_max_inr":      int(price * 1.1),
                "departure_times":    item.get("departure_times", []),
                "frequency":          item.get("frequency", ""),
                "booking_url":        item.get("booking_url", ""),
                "source":             source,
                "scraped_at":         datetime.utcnow().isoformat()
            })
        return records

    async def save_to_db(self, records: list[dict], destination_slug: str):
        if not records:
            return
        await self.upsert(
            "transport_options", records,
            ["origin_slug", "destination_slug", "mode", "operator"]
        )
        from core.supabase_client import db
        pairs = set((r["origin_slug"], r["destination_slug"]) for r in records)
        for origin_slug, dest_slug in pairs:
            db.table("city_pairs_index").upsert({
                "origin_slug": origin_slug,
                "destination_slug": dest_slug,
                "last_scraped": datetime.utcnow().isoformat(),
                "scrape_status": "done"
            }, on_conflict="origin_slug,destination_slug").execute()
