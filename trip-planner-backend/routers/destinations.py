"""
Destination discovery and comparison API endpoints.
All data comes from Supabase — no LLM, no agents.
Unknown destinations are handled by OnDemandScraper (Nominatim + SmartScraper).
"""
from fastapi import APIRouter, Query, Response
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.supabase_client import db

router = APIRouter(prefix="/destinations", tags=["destinations"])


@router.get("")
async def get_destinations(
    category: Optional[str] = None,
    state: Optional[str] = None,
    budget_tier: Optional[str] = None,
    best_month: Optional[int] = Query(None, ge=1, le=12),
    min_days: Optional[int] = None,
    max_days: Optional[int] = None,
    search: Optional[str] = None,
):
    """
    Get list of destinations with filtering.
    """
    query = db.table("destinations").select(
        "id, slug, name, state, category, description, "
        "avg_daily_budget_inr, best_months, avg_trip_duration_days"
    ).eq("is_active", True)

    # Apply filters
    if category:
        query = query.eq("category", category)
    if state:
        query = query.eq("state", state)
    if best_month:
        # Filter by best_months containing the month
        # This requires client-side filtering after fetch
        pass
    if min_days:
        query = query.gte("avg_trip_duration_days", min_days)
    if max_days:
        query = query.lte("avg_trip_duration_days", max_days)
    if search:
        query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%")

    response = query.execute()

    # Filter by best_month if specified (server-side check)
    results = response.data or []
    if best_month:
        results = [
            r for r in results
            if r.get("best_months") and best_month in r["best_months"]
        ]

    # Filter by budget tier
    if budget_tier:
        for r in results:
            budget_data = r.get("avg_daily_budget_inr", {})
            r["avg_daily_budget_tier"] = budget_data.get(budget_tier) if isinstance(budget_data, dict) else None

    # Add data_freshness (use scraped_at as proxy)
    for r in results:
        r["data_freshness"] = None

    return {"destinations": results, "count": len(results)}


@router.get("/compare")
async def compare_destinations(
    slugs: str = Query(..., description="Comma-separated slugs, max 3"),
):
    """
    Compare up to 3 destinations side-by-side.
    """
    slug_list = [s.strip() for s in slugs.split(",")][:3]

    if not slug_list:
        return {"error": "No slugs provided"}

    # Fetch all destinations
    response = db.table("destinations").select(
        "id, slug, name, state, category, avg_daily_budget_inr, "
        "best_months, avg_trip_duration_days, difficulty, nearest_airport_code"
    ).in_("slug", slug_list).execute()

    comparisons = []
    for dest in (response.data or []):
        dest_id = dest["id"]

        # Count places
        places_count = db.table("places").select(
            "id", count="exact"
        ).eq("destination_id", dest_id).execute()
        top_places_count = places_count.count if places_count.count else 0

        # Count hotels
        hotels_count = db.table("hotels").select(
            "id", count="exact"
        ).eq("destination_id", dest_id).execute()
        hotel_count = hotels_count.count if hotels_count.count else 0

        # Count upcoming events
        events_response = db.table("local_events").select("id").eq(
            "destination_id", dest_id
        ).execute()
        upcoming_events_count = len(events_response.data) if events_response.data else 0

        comparisons.append({
            "name": dest["name"],
            "category": dest["category"],
            "state": dest["state"],
            "avg_daily_budget_inr": dest.get("avg_daily_budget_inr"),
            "best_months": dest["best_months"],
            "avg_trip_duration_days": dest["avg_trip_duration_days"],
            "top_places_count": top_places_count,
            "hotel_count": hotel_count,
            "upcoming_events_count": upcoming_events_count,
            "difficulty": dest.get("difficulty"),
            "nearest_airport_code": dest.get("nearest_airport_code"),
        })

    return {"comparisons": comparisons}


@router.get("/{slug}")
async def get_destination_detail(slug: str, authenticated: bool = Query(True)):
    """
    Get full destination detail with places, hotels, events, news, blogs.
    """
    # Get destination
    dest_response = db.table("destinations").select("*").eq("slug", slug).execute()

    if not dest_response.data:
        if authenticated:
            # Try on-demand discovery
            from scrapers.on_demand import OnDemandScraper
            on_demand = OnDemandScraper()
            result = await on_demand.handle_unknown_destination(slug)

            if result.found:
                return JSONResponse(
                    status_code=202,
                    content={
                        "status": "discovering",
                        "destination": result.destination,
                        "scraping_in_progress": True,
                        "message": result.message,
                        "data_quality_score": 0,
                    },
                )
        return JSONResponse(
            status_code=404,
            content={"error": "Destination not found", "query": slug},
        )

    destination = dest_response.data[0]
    destination_id = destination["id"]

    # Get places
    places_response = db.table("places").select("*").eq(
        "destination_id", destination_id
    ).order("is_verified", desc=True).order("entry_fee_inr").execute()

    # Get hotels (non-stale only)
    hotels_response = db.table("hotels").select("*").eq(
        "destination_id", destination_id
    ).order("rating", desc=True).execute()
    hotels = [h for h in (hotels_response.data or []) if not h.get("is_stale", False)]

    # Get upcoming events (next 90 days)
    now = datetime.utcnow()
    ninety_days = now.replace(day=90)
    events_response = db.table("local_events").select("*").eq(
        "destination_id", destination_id
    ).execute()
    upcoming_events = []
    for event in (events_response.data or []):
        start_date = event.get("start_date")
        is_recurring = event.get("is_recurring", False)
        if is_recurring or start_date:
            if is_recurring:
                upcoming_events.append(event)
            else:
                try:
                    start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                    if now <= start_dt <= ninety_days:
                        upcoming_events.append(event)
                except:
                    pass

    # Get active news
    news_response = db.table("news_alerts").select("*").eq(
        "destination_id", destination_id
    ).gte("expires_at", now.isoformat()).order("severity").order(
        "published_at", desc=True
    ).limit(10).execute()

    # Get blog tips and insights
    blogs_response = db.table("blogs_and_guides").select(
        "key_tips, local_insights"
    ).eq("destination_id", destination_id).execute()

    blog_tips = []
    local_insights = []
    for blog in (blogs_response.data or []):
        blog_tips.extend(blog.get("key_tips", []))
        local_insights.extend(blog.get("local_insights", []))

    # Get weather cache
    weather_response = db.table("weather_cache").select(
        "forecast_json, scraped_at"
    ).eq("destination_id", destination_id).execute()

    weather_cache = None
    if weather_response.data:
        entry = weather_response.data[0]
        scraped_at = entry.get("scraped_at")
        if scraped_at:
            scraped_time = datetime.fromisoformat(scraped_at.replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - scraped_time).total_seconds() / 3600
            if age_hours < 3:
                weather_cache = entry

    return {
        "destination": destination,
        "places": places_response.data or [],
        "hotels": hotels,
        "upcoming_events": upcoming_events[:10],
        "active_news": news_response.data or [],
        "blog_tips": blog_tips[:10],
        "local_insights": local_insights[:10],
        "weather_cache": weather_cache,
    }


@router.get("/{slug}/scrape-status")
async def get_scrape_status(slug: str):
    """
    Check the current data quality and scrape state for a destination.
    Frontend can poll this every 10 s to know when on-demand data is ready.
    """
    dest_resp = db.table("destinations").select(
        "id, slug, is_active, data_quality_score, scraped_at"
    ).eq("slug", slug).execute()

    if not dest_resp.data:
        return JSONResponse(status_code=404, content={"error": "Destination not found"})

    dest = dest_resp.data[0]
    dest_id = dest["id"]

    # Count places and hotels
    places_resp = db.table("places").select("id", count="exact").eq(
        "destination_id", dest_id
    ).execute()
    hotels_resp = db.table("hotels").select("id", count="exact").eq(
        "destination_id", dest_id
    ).execute()

    places_count = places_resp.count or 0
    hotels_count = hotels_resp.count or 0

    # Determine if scraping is still in progress
    scraping_in_progress = False
    scraped_at = dest.get("scraped_at")
    if scraped_at:
        try:
            scrape_time = datetime.fromisoformat(scraped_at.replace("Z", "+00:00"))
            age = datetime.now(timezone.utc) - scrape_time
            scraping_in_progress = age < timedelta(minutes=5)
        except Exception:
            pass
    else:
        # No scraped_at means scrape hasn't completed yet
        scraping_in_progress = True

    return {
        "slug": slug,
        "is_active": dest.get("is_active", False),
        "data_quality_score": dest.get("data_quality_score", 0),
        "places_count": places_count,
        "hotels_count": hotels_count,
        "last_scraped": scraped_at,
        "scraping_in_progress": scraping_in_progress,
    }