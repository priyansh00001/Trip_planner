from agents.base_agent import BaseAgent
from core.config import settings
import httpx, logging

logger = logging.getLogger(__name__)

AVIATIONSTACK_URL = "https://api.aviationstack.com/v1/flights"


class FlightAgent(BaseAgent):
    name = "flights"

    async def fetch(self, state: dict) -> dict:
        req = state["request"]

        # Normalise origin/destination to 3-letter IATA codes.
        # The frontend passes e.g. "DEL" or "Mumbai" — take first 3 chars uppercased
        # as a best-effort. Users should pass proper IATA codes from the UI.
        origin_iata = req.origin_city.strip()[:3].upper()
        dest_iata   = req.destination.strip()[:3].upper()

        # --- No key or same-city edge case → return a graceful fallback ---
        if not settings.AVIATIONSTACK_API_KEY or origin_iata == dest_iata:
            return self._fallback(origin_iata, dest_iata, req)

        try:
            async with httpx.AsyncClient(timeout=12) as client:
                r = await client.get(
                    AVIATIONSTACK_URL,
                    params={
                        "access_key": settings.AVIATIONSTACK_API_KEY,
                        "dep_iata":   origin_iata,
                        "arr_iata":   dest_iata,
                        "limit":      5,
                        "flight_status": "scheduled",
                    },
                )
                r.raise_for_status()
                data = r.json().get("data", [])
        except Exception as e:
            logger.warning(f"FlightAgent: Aviationstack call failed ({e}), using fallback")
            return self._fallback(origin_iata, dest_iata, req)

        if not data:
            return self._fallback(origin_iata, dest_iata, req)

        # Extract the unique airlines that operate this route
        airlines = list({
            f.get("airline", {}).get("name", "Unknown")
            for f in data
            if f.get("airline", {}).get("name")
        })

        # Build a clean summary for the LLM
        routes = []
        for f in data[:3]:
            dep = f.get("departure", {})
            arr = f.get("arrival", {})
            routes.append({
                "airline":        f.get("airline", {}).get("name", "N/A"),
                "flight_number":  f.get("flight", {}).get("iata", "N/A"),
                "departure_time": dep.get("scheduled", "N/A"),
                "arrival_time":   arr.get("scheduled", "N/A"),
                "dep_airport":    dep.get("airport", origin_iata),
                "arr_airport":    arr.get("airport", dest_iata),
            })

        return {
            "route":         f"{origin_iata} → {dest_iata}",
            "airlines":      airlines,
            "sample_flights": routes,
            "booking_link":  self._google_flights_link(origin_iata, dest_iata, req.start_date),
            "note": "Prices not included — redirect users to Google Flights/MakeMyTrip for live fares.",
        }

    # ------------------------------------------------------------------ helpers

    def _fallback(self, origin: str, dest: str, req) -> dict:
        """Return a structured placeholder when the API is unavailable."""
        return {
            "route":    f"{origin} → {dest}",
            "airlines": ["IndiGo", "Air India", "SpiceJet"],  # common Indian carriers
            "sample_flights": [],
            "booking_link": self._google_flights_link(origin, dest, req.start_date),
            "note": (
                "Live flight data unavailable. "
                "Set AVIATIONSTACK_API_KEY in .env for real route data. "
                "Using deep-link to Google Flights for live pricing."
            ),
        }

    def _google_flights_link(self, origin: str, dest: str, date: str) -> str:
        return (
            f"https://www.google.com/flights"
            f"?hl=en#flt={origin}.{dest}.{date};c:INR;e:1;px:0;tt:o"
        )
