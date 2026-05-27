# IMPLEMENTATION NOTE:
# Flight node - fetches flight options with database fallback.
# First queries transport_options table for cached scraped flights.
# If empty, falls back to AviationStack/Google Flights.

import logging
from datetime import datetime
from agents.flight_agent import FlightAgent

logger = logging.getLogger(__name__)


async def flight_node(state: dict) -> dict:
    """Fetch flight options with transport_options DB fallback."""
    from core.supabase_client import db

    req = state["request"]
    
    # Normalize to slugs
    origin_slug = req.origin_city.strip().lower().replace(" ", "-")
    destination_slug = req.destination.strip().lower().replace(" ", "-")

    # Try database first
    try:
        res = db.table("transport_options").select("*")\
            .eq("origin_slug", origin_slug)\
            .eq("destination_slug", destination_slug)\
            .eq("mode", "flight")\
            .order("price_min_inr", desc=False)\
            .execute()

        if res.data:
            logger.info(f"Flights scraped options hit for {origin_slug} -> {destination_slug}")
            airlines = list({r.get("operator") for r in res.data if r.get("operator")})
            routes = []
            for r in res.data[:3]:
                routes.append({
                    "airline":        r.get("operator") or "N/A",
                    "flight_number":  "N/A",
                    "departure_time": r.get("departure_times")[0] if r.get("departure_times") else "N/A",
                    "arrival_time":   "N/A",
                    "dep_airport":    req.origin_city.strip()[:3].upper(),
                    "arr_airport":    req.destination.strip()[:3].upper(),
                    "price_min_inr":  r.get("price_min_inr"),
                    "price_max_inr":  r.get("price_max_inr"),
                    "duration_minutes": r.get("duration_minutes"),
                })
            
            booking_link = res.data[0].get("booking_url") or f"https://www.google.com/flights?hl=en#flt={req.origin_city.strip()[:3].upper()}.{req.destination.strip()[:3].upper()}.{req.start_date};c:INR;e:1;px:0;tt:o"

            return {
                "flights": {
                    "route":          f"{req.origin_city} → {req.destination}",
                    "airlines":       airlines,
                    "sample_flights":  routes,
                    "booking_link":   booking_link,
                    "note":           "Prices from scraped database",
                },
                "data_freshness": res.data[0].get("scraped_at") if res.data else None,
            }
    except Exception as e:
        logger.warning(f"Flights DB check failed: {e}")

    # Cache miss - call external API
    try:
        agent = FlightAgent()
        result = await agent.run(state)
        return {"flights": result.data}
    except Exception as e:
        logger.error(f"Flight node failed: {e}")
        return {"flights": {"error": str(e)}}