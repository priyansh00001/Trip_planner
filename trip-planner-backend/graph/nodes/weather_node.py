# IMPLEMENTATION NOTE:
# Weather node - fetches weather forecast with caching support.
# First checks weather_cache table (scraped_at < 3 hours old).
# If cache miss, calls OpenWeatherMap API and saves to cache.

import logging
from datetime import datetime, timezone, timedelta
from agents.weather_agent import WeatherAgent

logger = logging.getLogger(__name__)


async def weather_node(state: dict) -> dict:
    """Fetch weather forecast with cache support."""
    from core.supabase_client import db

    req = state["request"]
    destination_slug = req.destination.lower().replace(" ", "-")

    # Try cache first
    try:
        # Get destination ID
        dest_response = db.table("destinations").select("id").eq(
            "slug", destination_slug
        ).execute()

        if dest_response.data:
            destination_id = dest_response.data[0]["id"]

            # Check weather cache
            cache_response = db.table("weather_cache").select(
                "forecast_json, scraped_at"
            ).eq("destination_id", destination_id).execute()

            if cache_response.data:
                cache_entry = cache_response.data[0]
                scraped_at = cache_entry.get("scraped_at")

                if scraped_at:
                    # Check if less than 3 hours old
                    scraped_time = datetime.fromisoformat(
                        scraped_at.replace("Z", "+00:00")
                    )
                    age_hours = (datetime.now(timezone.utc) - scraped_time).total_seconds() / 3600

                    if age_hours < 3:
                        logger.info(f"Weather cache hit for {req.destination}")
                        return {
                            "weather": cache_entry["forecast_json"],
                            "data_freshness": scraped_at,
                        }
    except Exception as e:
        logger.warning(f"Weather cache check failed: {e}")

    # Cache miss - call API
    try:
        agent = WeatherAgent()
        result = await agent.run(state)

        # Save to cache
        if result.status == "ok" and dest_response.data:
            try:
                destination_id = dest_response.data[0]["id"]
                db.table("weather_cache").upsert(
                    {
                        "destination_id": destination_id,
                        "forecast_json": result.data,
                        "scraped_at": datetime.utcnow().isoformat(),
                    },
                    on_conflict="destination_id"
                ).execute()
                logger.info(f"Saved weather to cache for {req.destination}")
            except Exception as e:
                logger.warning(f"Failed to save weather cache: {e}")

        return {"weather": result.data}

    except Exception as e:
        logger.error(f"Weather node failed: {e}")
        return {"weather": {"error": str(e)}}