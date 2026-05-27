"""
Scraper management API endpoints.

GET  /api/scraper/status
  Returns pipeline liveness, per-task health, and per-destination scrape stats
  enriched with DB record counts and quality scores.

POST /api/scraper/trigger/{destination_slug}
  Forces immediate re-scrape of one destination.
  Requires X-Admin-Secret header matching ADMIN_SECRET env var.

GET  /api/scraper/events/stream
  SSE endpoint streaming live scraper events to the dashboard.

GET  /api/scraper/summary
  Full dashboard summary — DB counts, quality table, transport modes, LLM status.
"""

import asyncio
import json
from dataclasses import asdict
from datetime import datetime
from fastapi import APIRouter, Header, HTTPException, Request
from typing import Optional

from core.config import settings
from core.supabase_client import db
from core.llm_client import llm_client
from core.extraction_cache import extraction_cache

router = APIRouter(prefix="/scraper", tags=["scraper"])


@router.get("/status")
async def scraper_status(request: Request):
    """
    Return pipeline health + per-destination scrape stats.
    Enriches in-memory stats with live DB record counts and quality scores.
    """
    pipeline = request.app.state.pipeline
    status = pipeline.get_status()

    loop = asyncio.get_event_loop()

    # Enrich each known destination with DB data
    for slug, dest_stats in list(status["destinations"].items()):
        try:
            dest_resp = await loop.run_in_executor(
                None,
                lambda s=slug: db.table("destinations")
                    .select("id, data_quality_score, scraped_at")
                    .eq("slug", s)
                    .single()
                    .execute()
            )

            if dest_resp.data:
                row = dest_resp.data
                dest_stats["quality_score"] = row.get("data_quality_score", 0)
                dest_stats["db_scraped_at"] = row.get("scraped_at")

                dest_id = row.get("id")
                if dest_id:
                    places_resp = await loop.run_in_executor(
                        None,
                        lambda did=dest_id: db.table("places")
                            .select("id", count="exact")
                            .eq("destination_id", did)
                            .execute()
                    )
                    dest_stats["db_places"] = places_resp.count or 0

                    hotels_resp = await loop.run_in_executor(
                        None,
                        lambda did=dest_id: db.table("hotels")
                            .select("id", count="exact")
                            .eq("destination_id", did)
                            .execute()
                    )
                    dest_stats["db_hotels"] = hotels_resp.count or 0

        except Exception:
            # Non-fatal — dest_stats already has in-memory data
            pass

    # Enrich with LLM provider status and extraction cache stats
    status["llm"] = llm_client.status()
    status["extraction_cache"] = extraction_cache.stats()

    return status


@router.post("/trigger/{destination_slug}")
async def trigger_scraper(
    destination_slug: str,
    request: Request,
    x_admin_secret: Optional[str] = Header(None, alias="X-Admin-Secret"),
):
    """
    Manually trigger an immediate re-scrape for a specific destination.
    Requires X-Admin-Secret header.
    """
    admin_secret = getattr(settings, "ADMIN_SECRET", "")
    if not admin_secret or x_admin_secret != admin_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret")

    pipeline = request.app.state.pipeline
    try:
        await pipeline.trigger_destination(destination_slug)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return {
        "status": "triggered",
        "slug": destination_slug,
        "message": (
            f"Immediate re-scrape queued for '{destination_slug}'. "
            "Check /api/scraper/status for progress."
        ),
    }


@router.get("/events/stream")
async def events_stream(request: Request):
    """
    SSE endpoint — streams live scraper events to the dashboard.
    Sends last 50 events as initial burst, then subscribes to live events.
    Pings every 5s to keep the connection alive through proxies.
    """
    from core.event_bus import bus
    from sse_starlette.sse import EventSourceResponse

    async def generator():
        # Send last 50 events as initial burst
        for event in bus.recent_events(50):
            try:
                yield {"data": json.dumps(asdict(event))}
            except Exception:
                pass

        # Subscribe to live events
        q = bus.subscribe()
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(q.get(), timeout=5.0)
                    yield {"data": json.dumps(asdict(event))}
                except asyncio.TimeoutError:
                    # Ping to keep connection alive through proxies
                    yield {"data": json.dumps({"type": "ping", "ts": datetime.utcnow().isoformat()})}
        finally:
            bus.unsubscribe(q)

    return EventSourceResponse(generator())


@router.get("/summary")
async def scraper_summary(request: Request):
    """
    Full dashboard summary for polling every 15 seconds.
    Returns DB counts, destination quality table, transport mode coverage,
    recent scrape logs, event stats, LLM status, cache stats, pipeline status.
    Never returns 500 — all DB queries wrapped in try/except.
    """
    from core.event_bus import bus
    loop = asyncio.get_event_loop()

    # DB table row counts
    counts = {}
    for table in ["destinations", "places", "hotels",
                  "transport_options", "blogs_and_guides",
                  "news_alerts", "scraper_run_logs"]:
        try:
            r = await loop.run_in_executor(
                None,
                lambda t=table: db.table(t).select("*", count="exact").limit(0).execute()
            )
            counts[table] = r.count if r.count is not None else 0
        except Exception:
            counts[table] = -1

    # Destination quality breakdown (sorted by score desc)
    dest_quality = []
    try:
        dests = await loop.run_in_executor(
            None,
            lambda: db.table("destinations")
                .select("name,slug,data_quality_score,scraped_at,is_active")
                .execute()
        )
        dest_quality = sorted(
            dests.data or [],
            key=lambda d: d.get("data_quality_score") or 0,
            reverse=True,
        )
    except Exception:
        dest_quality = []

    # Transport mode coverage
    transport_by_mode = {}
    try:
        transport = await loop.run_in_executor(
            None,
            lambda: db.table("transport_options")
                .select("origin_slug,destination_slug,mode")
                .execute()
        )
        for row in (transport.data or []):
            m = row.get("mode", "unknown")
            transport_by_mode[m] = transport_by_mode.get(m, 0) + 1
    except Exception:
        transport_by_mode = {}

    # Recent scrape logs (newest first)
    recent_logs = []
    try:
        logs = await loop.run_in_executor(
            None,
            lambda: db.table("scraper_run_logs")
                .select("*")
                .order("created_at", desc=True)
                .limit(20)
                .execute()
        )
        recent_logs = logs.data or []
    except Exception:
        recent_logs = []

    pipeline = getattr(request.app.state, "pipeline", None)

    return {
        "db_counts":      counts,
        "dest_quality":   dest_quality,
        "transport_modes": transport_by_mode,
        "recent_logs":    recent_logs,
        "event_stats":    bus.get_stats(),
        "llm":            llm_client.status(),
        "cache":          extraction_cache.stats(),
        "pipeline":       pipeline.get_status() if pipeline else {},
        "generated_at":   datetime.utcnow().isoformat(),
    }