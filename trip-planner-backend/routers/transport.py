import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query, Request
from pydantic import BaseModel

from core.models import TransportOption, TransportSearchResponse
from core.supabase_client import db
from scrapers.transport_scraper import TransportScraper, slugify
from scrapers.transport_seed import get_seed_options

logger = logging.getLogger(__name__)
router = APIRouter()


class TriggerRequest(BaseModel):
    origin: str
    destination: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_option(r: dict) -> dict:
    """Normalise a raw DB / seed / scraper record into API shape."""
    return {
        "mode":             r.get("mode", ""),
        "operator":         r.get("operator", ""),
        "price_min_inr":    r.get("price_min_inr", 0),
        "price_max_inr":    r.get("price_max_inr", 0),
        "duration_minutes": r.get("duration_minutes"),
        "departure_times":  r.get("departure_times") or [],
        "frequency":        r.get("frequency", ""),
        "booking_url":      r.get("booking_url", ""),
        "source":           r.get("source", ""),
        "data_freshness":   r.get("scraped_at", ""),
    }


def _group_options(options: list) -> dict:
    grouped: Dict[str, List] = {"flight": [], "train": [], "bus": [], "cab": []}
    for opt in options:
        mode = opt.get("mode", "")
        if mode in grouped:
            grouped[mode].append(_format_option(opt))
    return grouped


def _hours_since(iso_str: str) -> float:
    """Return hours elapsed since an ISO timestamp. Returns 999 if unparseable."""
    if not iso_str:
        return 999.0
    try:
        ts = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - ts).total_seconds() / 3600
    except Exception:
        return 999.0


# ---------------------------------------------------------------------------
# Background helpers — always wrapped in try/except
# ---------------------------------------------------------------------------

async def _save_seed_to_db(seed: list, origin_slug: str, dest_slug: str):
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: db.table("transport_options").upsert(
                seed,
                on_conflict="origin_slug,destination_slug,mode,operator"
            ).execute()
        )
        logger.info(f"Seed saved to DB for {origin_slug}→{dest_slug}: {len(seed)} rows")
    except Exception as e:
        logger.error(f"Seed save failed for {origin_slug}→{dest_slug}: {e}")


async def _background_scrape_pair(origin: str, dest: str):
    origin_slug = slugify(origin)
    dest_slug   = slugify(dest)
    try:
        # Mark as scraping
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: db.table("city_pairs_index").upsert({
                "origin_slug":      origin_slug,
                "destination_slug": dest_slug,
                "scrape_status":    "scraping",
                "last_scraped":     datetime.now(timezone.utc).isoformat(),
            }, on_conflict="origin_slug,destination_slug").execute()
        )

        scraper = TransportScraper()
        records = await scraper._scrape_pair(origin, dest)
        if records:
            await scraper.save_to_db(records, dest_slug)
            logger.info(
                f"Background scrape {origin}→{dest}: {len(records)} records saved"
            )
        else:
            await loop.run_in_executor(
                None,
                lambda: db.table("city_pairs_index").upsert({
                    "origin_slug":      origin_slug,
                    "destination_slug": dest_slug,
                    "scrape_status":    "done",
                    "last_scraped":     datetime.now(timezone.utc).isoformat(),
                }, on_conflict="origin_slug,destination_slug").execute()
            )
    except Exception as e:
        logger.error(f"Background scrape failed for {origin}→{dest}: {e}")
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: db.table("city_pairs_index").upsert({
                    "origin_slug":      origin_slug,
                    "destination_slug": dest_slug,
                    "scrape_status":    "failed",
                    "last_scraped":     datetime.now(timezone.utc).isoformat(),
                }, on_conflict="origin_slug,destination_slug").execute()
            )
        except Exception:
            pass


# Legacy name kept so existing code path in bg_scrape_task still works
async def bg_scrape_task(origin: str, destination: str):
    await _background_scrape_pair(origin, destination)


# ---------------------------------------------------------------------------
# GET /api/transport — FIX 2: always returns something (seed fallback)
# ---------------------------------------------------------------------------

@router.get("/transport", response_model=TransportSearchResponse)
async def get_transport(
    origin: str = Query(..., min_length=2),
    destination: str = Query(..., min_length=2),
    travel_date: Optional[str] = None,
    authenticated: bool = Query(True),
    background_tasks: BackgroundTasks = None,
    request: Request = None,
):
    origin_slug = slugify(origin)
    dest_slug   = slugify(destination)

    # Step 1: Check DB
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: db.table("transport_options")
            .select("*")
            .eq("origin_slug", origin_slug)
            .eq("destination_slug", dest_slug)
            .order("price_min_inr", desc=False)
            .execute()
    )
    db_options: list = result.data or []

    scraping_in_progress = False
    data_source = "database"

    # Step 2: If DB empty — use seed immediately and trigger background scrape
    if not db_options:
        seed = get_seed_options(origin, destination)
        if seed:
            # Persist seed asynchronously so next request is fast
            asyncio.create_task(_save_seed_to_db(seed, origin_slug, dest_slug))
            data_source = "seed_data"
        else:
            data_source = "estimated"

        # Trigger live scrape in background
        scraping_in_progress = True
        asyncio.create_task(_background_scrape_pair(origin, destination))
        options_to_use = seed
    else:
        # Check freshness
        freshest = max(
            (r.get("scraped_at", "") for r in db_options),
            default=""
        )
        age_hours = _hours_since(freshest)
        scraping_in_progress = age_hours > 12
        if scraping_in_progress:
            asyncio.create_task(_background_scrape_pair(origin, destination))
        options_to_use = db_options

    # Step 3: Group by mode
    grouped: Dict[str, List[TransportOption]] = {
        "flight": [], "train": [], "bus": [], "cab": []
    }
    for r in options_to_use:
        mode = r.get("mode", "")
        if mode in grouped:
            grouped[mode].append(TransportOption(
                mode=mode,
                operator=r.get("operator") or "",
                price_min_inr=r.get("price_min_inr") or 0,
                price_max_inr=r.get("price_max_inr") or 0,
                duration_minutes=r.get("duration_minutes"),
                departure_times=r.get("departure_times") or [],
                frequency=r.get("frequency") or "",
                booking_url=r.get("booking_url") or "",
                source=r.get("source") or "",
                data_freshness=r.get("scraped_at") or "",
            ))

    # Step 4: If still no options after seed — add cab estimate
    if not any(v for v in grouped.values()):
        try:
            scraper = TransportScraper()
            cab = await scraper._estimate_cab(origin, destination)
            if cab:
                grouped["cab"].append(TransportOption(
                    mode="cab",
                    operator=cab.get("operator", "Intercity Cab (estimated)"),
                    price_min_inr=cab.get("price_min_inr", 0),
                    price_max_inr=cab.get("price_max_inr", 0),
                    duration_minutes=cab.get("duration_minutes"),
                    departure_times=[],
                    frequency="On demand",
                    booking_url=cab.get("booking_url", ""),
                    source="calculated",
                    data_freshness=datetime.utcnow().isoformat(),
                ))
                data_source = "estimated"
        except Exception as e:
            logger.warning(f"Cab estimate fallback failed: {e}")

    freshness = max(
        (r.get("scraped_at", "") for r in options_to_use),
        default=datetime.utcnow().isoformat()
    )

    message = ""
    if scraping_in_progress:
        message = (
            "Showing estimated prices. Live prices loading..."
            if data_source in ("seed_data", "estimated")
            else "Finding fresh transport options in background..."
        )

    return TransportSearchResponse(
        origin=origin,
        destination=destination,
        options=grouped,
        scraping_in_progress=scraping_in_progress,
        data_freshness=freshness,
        message=message,
    )


# ---------------------------------------------------------------------------
# POST /api/transport/scrape-now — FIX 3: SSE on-demand real-time scraper
# ---------------------------------------------------------------------------

@router.post("/transport/scrape-now")
async def scrape_transport_now(body: dict, request: Request):
    from sse_starlette.sse import EventSourceResponse
    from scrapers.google_transport_scraper import GoogleTransportScraper

    origin      = (body.get("origin") or "").strip()
    destination = (body.get("destination") or "").strip()

    if not origin or not destination:
        raise HTTPException(
            status_code=400, detail="origin and destination required"
        )

    async def stream():
        scraper = TransportScraper()
        google  = GoogleTransportScraper()

        # Immediately yield seed data
        try:
            seed = get_seed_options(origin, destination)
            if seed:
                yield {
                    "event": "seed_data",
                    "data": json.dumps({
                        "source":  "estimated",
                        "options": _group_options(seed),
                        "message": "Showing estimated prices while fetching live data...",
                    })
                }
        except Exception as e:
            logger.warning(f"Seed yield failed: {e}")

        # Also yield cab estimate immediately
        try:
            cab = await scraper._estimate_cab(origin, destination)
            if cab:
                yield {
                    "event": "cab_data",
                    "data": json.dumps({
                        "source":  "calculated",
                        "mode":    "cab",
                        "options": [_format_option(cab)],
                        "message": "Cab estimate based on distance",
                    })
                }
        except Exception as e:
            logger.warning(f"Cab estimate yield failed: {e}")

        # Scrape Google in parallel — one mode at a time, stream results
        async def scrape_mode(mode: str, coro):
            try:
                results = await asyncio.wait_for(coro, timeout=8.0)
                return mode, results
            except asyncio.TimeoutError:
                logger.warning(f"Timeout scraping {mode} {origin}→{destination}")
                return mode, []
            except Exception as e:
                logger.error(f"Error scraping {mode} {origin}→{destination}: {e}")
                return mode, []

        tasks = [
            asyncio.ensure_future(
                scrape_mode("flight", google.scrape_flights(origin, destination))
            ),
            asyncio.ensure_future(
                scrape_mode("train",  google.scrape_trains(origin, destination))
            ),
            asyncio.ensure_future(
                scrape_mode("bus",    google.scrape_buses(origin, destination))
            ),
        ]

        for future in asyncio.as_completed(tasks):
            try:
                mode, results = await future
                if results:
                    mapped = scraper._map_google_results(
                        results, origin, destination, mode
                    )
                    # Save to DB in background
                    asyncio.create_task(
                        scraper.save_to_db(
                            mapped,
                            destination.lower().replace(" ", "-")
                        )
                    )
                    yield {
                        "event": "live_data",
                        "data": json.dumps({
                            "source":  "live",
                            "mode":    mode,
                            "options": [_format_option(m) for m in mapped],
                            "message": f"Live {mode} prices loaded",
                        })
                    }
                else:
                    yield {
                        "event": "mode_failed",
                        "data": json.dumps({
                            "mode":    mode,
                            "message": f"No live {mode} data — using estimates",
                        })
                    }
            except Exception as e:
                logger.error(f"Stream mode iteration error: {e}")

        # Final complete event
        yield {
            "event": "complete",
            "data": json.dumps({"message": "All transport options loaded"})
        }

    return EventSourceResponse(stream())


# ---------------------------------------------------------------------------
# POST /api/transport/trigger — admin-only manual trigger (unchanged)
# ---------------------------------------------------------------------------

@router.post("/transport/trigger", status_code=202)
async def trigger_transport(
    body: TriggerRequest,
    background_tasks: BackgroundTasks,
    x_admin_secret: str = Header(..., alias="X-Admin-Secret"),
):
    import os
    expected_secret = os.environ.get("ADMIN_SECRET", "")
    if not expected_secret or x_admin_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    background_tasks.add_task(bg_scrape_task, body.origin, body.destination)
    return {"message": "Scraping triggered successfully"}
