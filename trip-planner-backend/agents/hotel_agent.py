"""
HotelAgent — fetches real hotel options using Nuitee LiteAPI.

Legal, structured data from a proper API (sandbox key already set).
Provides hotel names, ratings, price estimates and booking deep-links.
No scraping needed — LiteAPI has 2M+ properties worldwide.

Flow:
  1. Search hotels by city name → get hotel IDs + basic info
  2. Get live room rates for those IDs (requires dates, which we have)
  3. Filter by budget, return top 5 options with a Booking.com deep-link
"""

from agents.base_agent import BaseAgent
from core.config import settings
import httpx, logging

logger = logging.getLogger(__name__)

LITEAPI_BASE   = "https://api.liteapi.travel/v3.0"
LITEAPI_HEADER = {
    "X-API-Key": settings.LITEAPI_API_KEY,
    "accept":    "application/json",
    "content-type": "application/json",
}


class HotelAgent(BaseAgent):
    name = "hotels"

    async def fetch(self, state: dict) -> dict:
        req  = state["request"]
        city = req.destination.split(",")[0].strip()

        # ── Step 1: Get hotel IDs for this city ──────────────────────────────
        hotel_ids = await self._get_hotel_ids(city)

        if not hotel_ids:
            logger.warning(f"HotelAgent: No hotels found for '{city}', using fallback")
            return self._fallback(city, req)

        # ── Step 2: Get room rates for those hotels ───────────────────────────
        # Use first 20 IDs (LiteAPI recommends batches ≤ 20)
        rates = await self._get_rates(hotel_ids[:20], req.start_date, req.end_date)

        if not rates:
            return self._fallback(city, req)

        # ── Step 3: Filter by budget and rank by value ────────────────────────
        trip_days    = max(1, self._day_count(req.start_date, req.end_date))
        budget_inr   = req.budget_usd * 83          # rough USD→INR conversion
        hotel_budget = budget_inr * 0.40            # allocate ~40% of budget to hotels
        per_night    = hotel_budget / trip_days

        results = []
        for hotel in rates:
            hotel_name = hotel.get("name") or hotel.get("hotelName", "Unknown Hotel")
            rooms = hotel.get("roomTypes") or hotel.get("rooms") or []
            if not rooms:
                continue

            # Find cheapest room
            cheapest = min(
                rooms,
                key=lambda r: float(
                    (r.get("rates") or [{}])[0].get("retailRate", {})
                    .get("total", [{}])[0]
                    .get("amount", 9_999_999)
                ),
                default=None,
            )
            if not cheapest:
                continue

            rate_data  = (cheapest.get("rates") or [{}])[0]
            retail     = rate_data.get("retailRate", {}).get("total", [{}])
            price_usd  = float(retail[0].get("amount", 0)) if retail else 0
            currency   = retail[0].get("currency", "USD")  if retail else "USD"
            price_inr  = price_usd * 83 if currency == "USD" else price_usd

            results.append({
                "name":          hotel_name,
                "star_rating":   hotel.get("starRating"),
                "price_per_night_inr": round(price_inr / trip_days, 0),
                "total_price_inr":     round(price_inr, 0),
                "currency":      "INR",
                "within_budget": price_inr <= per_night * trip_days,
                "booking_link":  self._booking_link(hotel_name, city, req.start_date, req.end_date),
            })

        # Sort: within-budget first, then by price
        results.sort(key=lambda h: (not h["within_budget"], h["total_price_inr"]))

        return {
            "city":              city,
            "hotels":            results[:6],
            "budget_per_night_inr": round(per_night, 0),
            "trip_days":         trip_days,
            "note": (
                "Prices from LiteAPI sandbox (may differ from live rates). "
                "Click booking links for confirmed pricing."
            ),
        }

    # ─────────────────────────────────── private helpers ────────────────────

    async def _get_hotel_ids(self, city: str) -> list[str]:
        """Static data endpoint — returns hotel IDs for a city."""
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    f"{LITEAPI_BASE}/data/hotels",
                    headers=LITEAPI_HEADER,
                    params={
                        "cityName": city,
                        "limit":    20,
                    },
                )
                r.raise_for_status()
                hotels = r.json().get("data", [])
                return [h["id"] for h in hotels if h.get("id")]
        except Exception as e:
            logger.warning(f"HotelAgent: hotel ID lookup failed — {e}")
            return []

    async def _get_rates(self, hotel_ids: list, check_in: str, check_out: str) -> list:
        """Rates endpoint — returns live room pricing for a batch of hotel IDs."""
        if not hotel_ids:
            return []
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(
                    f"{LITEAPI_BASE}/hotels/rates",
                    headers=LITEAPI_HEADER,
                    json={
                        "hotelIds":       hotel_ids,
                        "occupancies":    [{"adults": 2, "children": []}],
                        "currency":       "USD",
                        "guestNationality": "IN",
                        "checkin":        check_in,
                        "checkout":       check_out,
                    },
                )
                r.raise_for_status()
                return r.json().get("data", {}).get("hotels", [])
        except Exception as e:
            logger.warning(f"HotelAgent: rates lookup failed — {e}")
            return []

    def _fallback(self, city: str, req) -> dict:
        """Return a graceful fallback when LiteAPI is unavailable."""
        trip_days = max(1, self._day_count(req.start_date, req.end_date))
        return {
            "city":    city,
            "hotels":  [],
            "budget_per_night_inr": round((req.budget_usd * 83 * 0.40) / trip_days, 0),
            "trip_days": trip_days,
            "booking_link": self._booking_link("", city, req.start_date, req.end_date),
            "note": "Live hotel data unavailable. Check Booking.com directly for options.",
        }

    @staticmethod
    def _day_count(start: str, end: str) -> int:
        from datetime import date
        try:
            return abs((date.fromisoformat(end) - date.fromisoformat(start)).days)
        except Exception:
            return 1

    @staticmethod
    def _booking_link(hotel_name: str, city: str, check_in: str, check_out: str) -> str:
        import urllib.parse
        query = hotel_name if hotel_name else city
        return (
            f"https://www.booking.com/searchresults.html"
            f"?ss={urllib.parse.quote(query)}"
            f"&checkin={check_in}&checkout={check_out}"
            f"&no_rooms=1&group_adults=2&aid=304142"
        )
