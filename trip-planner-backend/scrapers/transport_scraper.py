"""
TransportScraper — builds real transport records for city pairs.

Sources (in order of reliability based on live probing):
  1. OpenFlights routes.dat (GitHub raw CSV, always 200, no bot block)
       → airline codes + IATA lookup → booking deep-link + price band
  2. Railyatri (train HTML, scraper-friendly, 200 OK)
       → BrowserAgent extract → train names, classes, prices
  3. Redbus (bus HTML, with UA-retry on block — FIX 2D)
       → BrowserAgent extract with fallback UA rotation
  4. Cab estimate from local CITY_COORDINATES dict (FIX 2C)
       → haversine distance → INR-per-km estimate
       → Nominatim only for unknown cities

FIX 2A — Replaced blocked RedBus+Ixigo primaries with OpenFlights + Railyatri.
FIX 2B — _try_json_api() helper for JSON-returning endpoints (no Playwright).
FIX 2C — CITY_COORDINATES dict covers 25 destinations + 15 origin cities.
           Nominatim is fallback-only for unknown cities.
FIX 2D — BrowserAgent retried once with a different UA on navigation failure.
"""

import asyncio
import csv
import io
import logging
import math
import random
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Tuple

import httpx

from scrapers.base import BaseScraper
from scrapers.browser_agent import BrowserAgent
from scrapers.station_codes import (
    get_airport_code, get_railway_code, has_railway
)
from core.event_bus import bus, ScraperEvent
from scrapers.google_transport_scraper import GoogleTransportScraper
from scrapers.transport_seed import get_seed_options

logger = logging.getLogger(__name__)


def slugify(text: str) -> str:
    return text.lower().replace(" ", "-")


# ---------------------------------------------------------------------------
# FIX 2C — Local coordinate cache
# Covers all 25 scheduled destinations + 15 major origin cities.
# Keys are lowercase, no-space city names for fast lookup.
# ---------------------------------------------------------------------------
CITY_COORDINATES: Dict[str, Tuple[float, float]] = {
    # Major origin cities
    "delhi":        (28.6139,  77.2090),
    "newdelhi":     (28.6139,  77.2090),
    "mumbai":       (19.0760,  72.8777),
    "bangalore":    (12.9716,  77.5946),
    "bengaluru":    (12.9716,  77.5946),
    "chennai":      (13.0827,  80.2707),
    "kolkata":      (22.5726,  88.3639),
    "hyderabad":    (17.3850,  78.4867),
    "ahmedabad":    (23.0225,  72.5714),
    "pune":         (18.5204,  73.8567),
    "lucknow":      (26.8467,  80.9462),
    "chandigarh":   (30.7333,  76.7794),
    "bhopal":       (23.2599,  77.4126),
    "kochi":        ( 9.9312,  76.2673),
    "guwahati":     (26.1445,  91.7362),
    "patna":        (25.5941,  85.1376),
    # 25 scheduled destinations
    "jaipur":       (26.9124,  75.7873),
    "udaipur":      (24.5854,  73.7125),
    "jodhpur":      (26.2389,  73.0243),
    "jaisalmer":    (26.2976,  70.9178),
    "pushkar":      (26.4897,  74.5501),
    "goa":          (15.2993,  74.1240),
    "goanorth":     (15.5420,  73.7594),
    "goasouth":     (15.0100,  74.0200),
    "varkala":      ( 8.7378,  76.7150),
    "kovalam":      ( 8.3930,  76.9780),
    "munnar":       (10.0889,  77.0595),
    "coorg":        (12.3376,  75.8069),
    "hampi":        (15.3350,  76.4600),
    "pondicherry":  (11.9416,  79.8083),
    "manali":       (32.2432,  77.1892),
    "shimla":       (31.1048,  77.1734),
    "dharamshala":  (32.2190,  76.3234),
    "spitivalley":  (32.4500,  78.0500),
    "darjeeling":   (27.0360,  88.2627),
    "gangtok":      (27.3313,  88.6138),
    "varanasi":     (25.3176,  82.9739),
    "agra":         (27.1767,  78.0081),
    "andamanislands":(11.7181, 92.7206),
    "portblair":    (11.6234,  92.7265),
    "kaziranga":    (26.5958,  93.1713),
    "ranthambore":  (25.0202,  76.6019),
    "jimcorbett":   (29.5300,  78.8900),
}

# IATA codes for city → airport lookup (used by OpenFlights)
CITY_IATA: Dict[str, str] = {
    "delhi": "DEL",  "new delhi": "DEL",
    "mumbai": "BOM", "bombay": "BOM",
    "bangalore": "BLR", "bengaluru": "BLR",
    "chennai": "MAA", "kolkata": "CCU", "calcutta": "CCU",
    "hyderabad": "HYD", "ahmedabad": "AMD", "pune": "PNQ",
    "kochi": "COK", "cochin": "COK",
    "guwahati": "GAU", "patna": "PAT",
    "jaipur": "JAI", "udaipur": "UDR", "jodhpur": "JDH",
    "goa": "GOI", "goa north": "GOI", "goa south": "GOI",
    "varanasi": "VNS", "agra": "AGR",
    "lucknow": "LKO", "chandigarh": "IXC",
    "manali": None,  # no airport
    "shimla": "SLV",
    "dharamshala": "DHM",
    "darjeeling": "IXB",  # nearest: Bagdogra
    "gangtok": "IXB",     # nearest: Bagdogra
    "andaman islands": "IXZ", "port blair": "IXZ",
}


# ---------------------------------------------------------------------------
# Airline code → full name (from OpenFlights airlines.dat subset)
# ---------------------------------------------------------------------------
AIRLINE_NAMES: Dict[str, str] = {
    "6E": "IndiGo",
    "AI": "Air India",
    "SG": "SpiceJet",
    "UK": "Vistara",
    "G8": "Go First",
    "9W": "Jet Airways",
    "S2": "SpiceJet",
    "IX": "Air India Express",
    "QP": "Akasa Air",
    "I5": "Air Asia India",
}


class TransportScraper(BaseScraper):
    source_name = "transport"
    scrape_interval_hours = 12

    MAJOR_CITIES = [
        "Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata",
        "Hyderabad", "Ahmedabad", "Pune", "Jaipur", "Lucknow",
        "Chandigarh", "Bhopal", "Kochi", "Guwahati", "Patna"
    ]

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

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

    async def _scrape_pair(
        self, origin: str, destination: str
    ) -> list[dict]:
        logger.info(f"Transport scrape: {origin}→{destination}")
        results = []
        google  = GoogleTransportScraper()

        # --- LAYER 1: Google Search scraping ---
        try:
            flights, trains, buses = await asyncio.gather(
                google.scrape_flights(origin, destination),
                google.scrape_trains(origin, destination),
                google.scrape_buses(origin, destination),
                return_exceptions=True
            )
            for mode, data in [
                ("flight", flights),
                ("train",  trains),
                ("bus",    buses)
            ]:
                if isinstance(data, list) and data:
                    mapped = self._map_google_results(
                        data, origin, destination, mode
                    )
                    results.extend(mapped)
                    logger.info(
                        f"Google {mode} {origin}→{destination}: "
                        f"{len(mapped)} results"
                    )
                    bus.emit_sync(ScraperEvent(
                        type="transport_done",
                        destination=destination,
                        mode=mode,
                        count=len(mapped),
                        detail=f"Google search — {origin}→{destination}"
                    ))
                else:
                    logger.warning(
                        f"Google {mode} {origin}→{destination}: "
                        f"no results — will use seed data"
                    )
        except Exception as e:
            logger.error(f"Google transport scrape failed: {e}")

        # --- LAYER 2: Cab estimate (always run) ---
        cab = await self._estimate_cab(origin, destination)
        if cab:
            results.append(cab)

        # --- LAYER 3: Seed data fallback for missing modes ---
        scraped_modes = set(r["mode"] for r in results)
        seed_options  = get_seed_options(origin, destination)

        for item in seed_options:
            mode = item["mode"]
            if mode not in scraped_modes:
                results.append(item)
                logger.info(
                    f"Seed fallback {mode} {origin}→{destination}: "
                    f"{item['operator']} ₹{item['price_min_inr']}–"
                    f"{item['price_max_inr']}"
                )

        logger.info(
            f"Transport TOTAL {origin}→{destination}: "
            f"{len(results)} records "
            f"({len(scraped_modes)} modes from Google, "
            f"seed for rest)"
        )
        return results

    def _map_google_results(
        self,
        items: list[dict],
        origin: str,
        destination: str,
        mode: str
    ) -> list[dict]:
        from slugify import slugify
        from datetime import datetime
        results = []
        for item in items:
            price = item.get("price_inr", 0)
            if not price:
                continue
            results.append({
                "origin_city":        origin,
                "destination_city":   destination,
                "origin_slug":        slugify(origin),
                "destination_slug":   slugify(destination),
                "mode":               mode,
                "operator":           item.get("operator", ""),
                "price_min_inr":      int(price * 0.9),
                "price_max_inr":      int(price * 1.15),
                "duration_minutes":   item.get("duration_minutes"),
                "departure_times":    item.get("departure_times", []),
                "frequency":          item.get("frequency", ""),
                "booking_url":        self._booking_url(
                                        mode, origin, destination,
                                        item.get("operator", "")
                                      ),
                "source":             "google_search",
                "scraped_at":         datetime.utcnow().isoformat(),
            })
        return results

    def _booking_url(
        self, mode: str, origin: str,
        destination: str, operator: str
    ) -> str:
        from scrapers.transport_seed import _booking_url
        return _booking_url(mode, origin, destination, operator)

    # -----------------------------------------------------------------------
    # Flight scraping via OpenFlights with Ixigo Deep Link
    # -----------------------------------------------------------------------

    async def _scrape_ixigo_flights(self, origin: str, dest: str) -> list[dict]:
        """
        Fetch routes.dat from OpenFlights GitHub raw.
        Build flight records for IATA-known city pairs, generating Ixigo search URLs.
        """
        origin_code = get_airport_code(origin)
        dest_code   = get_airport_code(dest)
        if not origin_code or not dest_code:
            logger.warning(f"No airport code for {origin} or {dest}")
            return []

        try:
            routes_data = await self._fetch_openflights_routes()
        except Exception as e:
            logger.warning(f"TransportScraper: OpenFlights fetch failed: {e}")
            return []

        # Filter routes matching this pair
        matching: list[dict] = []
        for row in routes_data:
            if len(row) < 6:
                continue
            airline_code = row[0].strip()
            src = row[2].strip()
            dst = row[4].strip()
            if src == origin_code and dst == dest_code:
                matching.append({"airline_code": airline_code})

        if not matching:
            logger.debug(f"TransportScraper: No OpenFlights routes found for {origin_code}→{dest_code}")
            return []

        # Deduplicate by airline code
        seen_airlines: set = set()
        records: list[dict] = []
        travel_date = (date.today() + timedelta(days=30)).strftime("%Y%m%d")

        for m in matching:
            code = m["airline_code"]
            if code in seen_airlines:
                continue
            seen_airlines.add(code)
            airline_name = AIRLINE_NAMES.get(code, code)

            # Estimate distance-based price
            dist_km = await self._haversine_distance_local(origin, dest)
            if dist_km:
                price_min = max(1500, int(dist_km * 4))
                price_max = max(3500, int(dist_km * 8))
            else:
                price_min, price_max = 1500, 5000

            booking_url = f"https://www.ixigo.com/search/result/flight/{origin_code}/{dest_code}/{travel_date}/1/0/0/E/OW"

            records.append({
                "origin_city":      origin,
                "destination_city": dest,
                "origin_slug":      slugify(origin),
                "destination_slug": slugify(dest),
                "mode":             "flight",
                "operator":         airline_name,
                "duration_minutes": None,
                "price_min_inr":    price_min,
                "price_max_inr":    price_max,
                "departure_times":  [],
                "frequency":        "Daily",
                "booking_url":      booking_url,
                "source":           "openflights",
                "scraped_at":       datetime.utcnow().isoformat(),
            })

        logger.info(f"TransportScraper: {len(records)} flight records for {origin}→{dest} via OpenFlights (Ixigo link)")
        return records

    async def _fetch_openflights_routes(self) -> list[list[str]]:
        """Download routes.dat from OpenFlights GitHub raw. Cached per process lifetime."""
        if not hasattr(TransportScraper, "_routes_cache"):
            data = await self._try_json_api(
                "https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat",
                accept_text=True,
            )
            if not data or not isinstance(data, str):
                TransportScraper._routes_cache = []
            else:
                rows = []
                for line in data.strip().split("\n"):
                    line = line.strip()
                    if line:
                        try:
                            rows.append(next(csv.reader(io.StringIO(line))))
                        except Exception:
                            pass
                TransportScraper._routes_cache = rows
                logger.info(f"TransportScraper: Loaded {len(rows)} routes from OpenFlights")
        return TransportScraper._routes_cache

    # -----------------------------------------------------------------------
    # Train scraping via Railyatri using station codes
    # -----------------------------------------------------------------------

    async def _scrape_ixigo_trains(self, origin: str, dest: str) -> list[dict]:
        """
        Scrape Railyatri trains-between-stations page using railway station codes.
        """
        if not has_railway(origin) or not has_railway(dest):
            logger.info(f"No rail connectivity: {origin}→{dest}")
            return []
        origin_code = get_railway_code(origin)
        dest_code   = get_railway_code(dest)
        url = f"https://www.railyatri.in/trains-between-stations?from={origin_code}&to={dest_code}"

        agent = BrowserAgent()
        raw = await agent.extract_from_url(url, f"{origin} to {dest} trains")

        # If thin/skipped, try BrowserAgent on Wikipedia transport section as fallback
        if raw.get("_skipped") or not raw.get("transport"):
            logger.debug(f"TransportScraper: Railyatri thin for {origin}→{dest}, trying wiki fallback")
            wiki_dest = dest.replace(" ", "_")
            raw = await agent.extract_from_url(
                f"https://en.wikipedia.org/wiki/{wiki_dest}",
                f"{dest} transport"
            )

        records = self._map_to_schema(raw, origin, dest, "train", "railyatri")
        logger.info(f"TransportScraper: {len(records)} train records for {origin}→{dest}")
        return records

    # -----------------------------------------------------------------------
    # Bus scraping via BrowserAgent with rotated UA retry and HTTP2 handling
    # -----------------------------------------------------------------------

    async def _scrape_redbus(self, origin: str, dest: str) -> list[dict]:
        """
        Scrape Redbus using BrowserAgent, with UA retry and HTTP2/ERR_ error handling.
        """
        travel_date = (date.today() + timedelta(days=30)).strftime("%d-%b-%Y")
        url = (
            f"https://www.redbus.in/bus-tickets"
            f"/{origin.lower()}-to-{dest.lower()}"
            f"?fromCityName={origin}&toCityName={dest}&doj={travel_date}"
        )

        agent = BrowserAgent()
        try:
            raw = await agent.extract_from_url(url, f"{origin} to {dest} bus")
            # If the result is empty (nav block) or skipped, retry with different UA
            if not raw or raw.get("_skipped") or (not raw.get("transport") and not raw.get("places")):
                delay = random.uniform(2, 5)
                logger.warning(
                    f"TransportScraper: Redbus appears blocked for {origin}→{dest}. "
                    f"Retrying in {delay:.1f}s with rotated UA..."
                )
                await asyncio.sleep(delay)

                # Fresh BrowserAgent instance (will pick a new random UA on launch)
                agent2 = BrowserAgent()
                raw = await agent2.extract_from_url(url, f"{origin} to {dest} bus")

            records = self._map_to_schema(raw, origin, dest, "bus", "redbus")
            return records
        except Exception as e:
            if "HTTP2" in str(e) or "ERR_" in str(e):
                logger.warning(f"RedBus blocked for {origin}→{dest}: {e}")
                return []
            raise

    # -----------------------------------------------------------------------
    # FIX 2B — Generic httpx JSON/text API fetcher (no Playwright)
    # -----------------------------------------------------------------------

    async def _try_json_api(self, url: str, accept_text: bool = False) -> dict | str | None:
        """
        Lightweight httpx GET for endpoints that return JSON or plain text.
        Returns:
          - parsed dict  if response is JSON
          - raw string   if accept_text=True and response is not JSON
          - None         on any failure
        """
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; TripPlannerBot/1.0)",
            "Accept": "application/json, text/plain, */*",
        }
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True, headers=headers) as client:
                r = await client.get(url)
                if r.status_code != 200:
                    logger.debug(f"TransportScraper: _try_json_api {url} returned {r.status_code}")
                    return None
                ct = r.headers.get("content-type", "")
                if "json" in ct:
                    return r.json()
                if accept_text:
                    return r.text
                return None
        except Exception as e:
            logger.warning(f"TransportScraper: _try_json_api failed for {url}: {e}")
            return None

    # -----------------------------------------------------------------------
    # FIX 2C — Coordinates: local dict first, Nominatim only for unknowns
    # -----------------------------------------------------------------------

    def _coords_from_cache(self, city: str) -> Optional[Tuple[float, float]]:
        """Look up city in local CITY_COORDINATES dict."""
        key = city.lower().replace(" ", "").replace("-", "")
        return CITY_COORDINATES.get(key)

    async def _get_coordinates(self, city: str) -> Optional[Tuple[float, float]]:
        """Return coordinates from local cache or fall back to Nominatim."""
        cached = self._coords_from_cache(city)
        if cached:
            return cached

        # Nominatim fallback for unknown cities (1 req/sec limit respected by caller)
        url = (
            f"https://nominatim.openstreetmap.org/search"
            f"?q={city}&format=json&limit=1"
        )
        try:
            async with httpx.AsyncClient(timeout=5, follow_redirects=True) as client:
                r = await client.get(url, headers={"User-Agent": "TripPlannerApp/1.0"})
            if r.status_code == 200:
                data = r.json()
                if data:
                    return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception as e:
            logger.warning(f"TransportScraper: Nominatim failed for {city}: {e}")
        return None

    async def _haversine_distance_local(self, origin: str, dest: str) -> Optional[float]:
        """Compute haversine distance preferring local coord cache."""
        orig_coords = self._coords_from_cache(origin)
        dest_coords = self._coords_from_cache(dest)

        # Only call Nominatim if both are unknown (saves rate-limit budget)
        if not orig_coords:
            orig_coords = await self._get_coordinates(origin)
        if not dest_coords:
            dest_coords = await self._get_coordinates(dest)

        if not orig_coords or not dest_coords:
            return None

        lat1, lon1 = orig_coords
        lat2, lon2 = dest_coords
        R = 6371
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = (
            math.sin(dLat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dLon / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Keep the old name for backward compatibility (used in tests)
    async def _haversine_distance(self, origin: str, dest: str) -> Optional[float]:
        return await self._haversine_distance_local(origin, dest)

    async def _estimate_cab(self, origin: str, dest: str) -> dict | None:
        """Estimate intercity cab fare using haversine distance."""
        try:
            dist_km = await self._haversine_distance_local(origin, dest)
            if dist_km is None or dist_km > 800:
                return None
            price_min = int(dist_km * 12)
            price_max = int(dist_km * 18)
            duration_min = int(dist_km / 60 * 60)  # ~60 km/h average
            return {
                "origin_city":      origin,
                "destination_city": dest,
                "origin_slug":      slugify(origin),
                "destination_slug": slugify(dest),
                "mode":             "cab",
                "operator":         "Intercity Cab (estimated)",
                "price_min_inr":    price_min,
                "price_max_inr":    price_max,
                "duration_minutes": duration_min,
                "departure_times":  [],
                "frequency":        "On demand",
                "booking_url":      (
                    f"https://www.olacabs.com/outstation/{origin.lower()}-to-{dest.lower()}"
                ),
                "source":           "calculated",
                "scraped_at":       datetime.utcnow().isoformat(),
            }
        except Exception as e:
            logger.warning(f"TransportScraper: cab estimate failed for {origin}→{dest}: {e}")
            return None

    # -----------------------------------------------------------------------
    # Schema mapping
    # -----------------------------------------------------------------------

    def _map_to_schema(
        self, raw: dict, origin: str, dest: str, mode: str, source: str
    ) -> list[dict]:
        records = []
        for item in raw.get("transport", []):
            price = item.get("price_inr", 0)
            if not price or price <= 0:
                continue
            records.append({
                "origin_city":      origin,
                "destination_city": dest,
                "origin_slug":      slugify(origin),
                "destination_slug": slugify(dest),
                "mode":             mode,
                "operator":         item.get("operator", ""),
                "duration_minutes": item.get("duration_minutes"),
                "price_min_inr":    int(price * 0.9),
                "price_max_inr":    int(price * 1.1),
                "departure_times":  item.get("departure_times", []),
                "frequency":        item.get("frequency", ""),
                "booking_url":      item.get("booking_url", ""),
                "source":           source,
                "scraped_at":       datetime.utcnow().isoformat(),
            })
        return records

    # -----------------------------------------------------------------------
    # DB persistence
    # -----------------------------------------------------------------------

    async def save_to_db(self, records: list[dict], destination_slug: str):
        if not records:
            return
        await self.upsert(
            "transport_options", records,
            ["origin_slug", "destination_slug", "mode", "operator"]
        )
        from core.supabase_client import db
        pairs = set((r["origin_slug"], r["destination_slug"]) for r in records)
        loop = asyncio.get_event_loop()
        for origin_slug, dest_slug in pairs:
            await loop.run_in_executor(
                None,
                lambda o=origin_slug, d=dest_slug: db.table("city_pairs_index").upsert(
                    {
                        "origin_slug":      o,
                        "destination_slug": d,
                        "last_scraped":     datetime.utcnow().isoformat(),
                        "scrape_status":    "done",
                    },
                    on_conflict="origin_slug,destination_slug",
                ).execute()
            )

