# IMPLEMENTATION NOTE:
# Flight node - fetches flight options with database fallback.
# First queries flights table for cached results.
# If empty, falls back to AviationStack/Google Flights.

import logging
from datetime import datetime
from agents.flight_agent import FlightAgent

logger = logging.getLogger(__name__)


async def flight_node(state: dict) -> dict:
    """Fetch flight options with DB fallback."""
    from core.supabase_client import db

    req = state["request"]
    destination_slug = req.destination.lower().replace(" ", "-")

    # Normalize to IATA codes
    origin_iata = req.origin_city.strip()[:3].upper()
    dest_iata = req.destination.strip()[:3].upper()

    # Try database first
    try:
        dest_response = db.table("destinations").select("id").eq(
            "slug", destination_slug
        ).execute()

        if dest_response.data:
            destination_id = dest_response.data[0]["id"]

            # Get the actual airport code from destination
            dest_detail = db.table("destinations").select(
                "nearest_airport_code"
            ).eq("id", destination_id).execute()

            if dest_detail.data and dest_detail.data[0].get("nearest_airport_code"):
                dest_iata = dest_detail.data[0]["nearest_airport_code"]

            # Query flights table
            flights_response = db.table("flights").select("*").eq(
                "origin_iata", origin_iata
            ).eq("destination_iata", dest_iata).gte(
                "departure_date", req.start_date
            ).order("price_inr").limit(5).execute()

            if flights_response.data:
                logger.info(f"Flights cache hit for {origin_iata}-{dest_iata}")
                return {
                    "flights": {
                        "route": f"{origin_iata} → {dest_iata}",
                        "cached_flights": flights_response.data,
                        "note": "Prices from database cache",
                    },
                    "data_freshness": flights_response.data[0].get("scraped_at") if flights_response.data else None,
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