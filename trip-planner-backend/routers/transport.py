import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query
from pydantic import BaseModel

from core.models import TransportOption, TransportSearchResponse
from core.supabase_client import db
from scrapers.transport_scraper import TransportScraper, slugify

logger = logging.getLogger(__name__)
router = APIRouter()

class TriggerRequest(BaseModel):
    origin: str
    destination: str

async def bg_scrape_task(origin: str, destination: str):
    origin_slug = slugify(origin)
    destination_slug = slugify(destination)
    try:
        # Mark index as scraping
        db.table("city_pairs_index").upsert({
            "origin_slug": origin_slug,
            "destination_slug": destination_slug,
            "scrape_status": "scraping",
            "last_scraped": datetime.now(timezone.utc).isoformat()
        }, on_conflict="origin_slug,destination_slug").execute()

        scraper = TransportScraper()
        records = await scraper._scrape_pair(origin, destination)
        
        # Save to DB
        await scraper.save_to_db(records, destination_slug)
        logger.info(f"Background scrape for {origin} -> {destination} finished. Saved {len(records)} records.")
    except Exception as e:
        logger.error(f"Background scrape failed for {origin} -> {destination}: {e}")
        db.table("city_pairs_index").upsert({
            "origin_slug": origin_slug,
            "destination_slug": destination_slug,
            "scrape_status": "failed",
            "last_scraped": datetime.now(timezone.utc).isoformat()
        }, on_conflict="origin_slug,destination_slug").execute()

@router.get("/transport", response_model=TransportSearchResponse)
async def get_transport(
    origin: str = Query(..., min_length=2),
    destination: str = Query(..., min_length=2),
    travel_date: Optional[str] = None,
    background_tasks: BackgroundTasks = None
):
    origin_slug = slugify(origin)
    destination_slug = slugify(destination)

    # 1. Check city pair index for scraping status and last_scraped
    index_res = db.table("city_pairs_index")\
                  .select("*")\
                  .eq("origin_slug", origin_slug)\
                  .eq("destination_slug", destination_slug)\
                  .execute()
    
    index_entry = index_res.data[0] if index_res.data else None
    
    is_stale = True
    scraping_in_progress = False
    data_freshness = None

    if index_entry:
        last_scraped_str = index_entry.get("last_scraped")
        status = index_entry.get("scrape_status", "pending")
        if last_scraped_str:
            last_scraped = datetime.fromisoformat(last_scraped_str.replace("Z", "+00:00"))
            data_freshness = last_scraped_str
            # Fresh if scraped within last 12 hours
            if datetime.now(timezone.utc) - last_scraped < timedelta(hours=12) and status == "done":
                is_stale = False
        
        if status == "scraping":
            scraping_in_progress = True
            is_stale = False # Don't fire another if already scraping

    # 2. Fetch existing transport options
    options_res = db.table("transport_options")\
                    .select("*")\
                    .eq("origin_slug", origin_slug)\
                    .eq("destination_slug", destination_slug)\
                    .order("price_min_inr", desc=False)\
                    .execute()
    
    records = options_res.data or []

    # If empty or stale, and not currently scraping, trigger background scraping
    if (not records or is_stale) and not scraping_in_progress:
        scraping_in_progress = True
        if background_tasks:
            background_tasks.add_task(bg_scrape_task, origin, destination)
        else:
            # Fallback if background_tasks is somehow None
            asyncio.create_task(bg_scrape_task(origin, destination))

    # Group records by mode
    grouped_options: Dict[str, List[TransportOption]] = {
        "flight": [],
        "train": [],
        "bus": [],
        "cab": []
    }

    for r in records:
        mode = r.get("mode")
        if mode in grouped_options:
            grouped_options[mode].append(TransportOption(
                mode=mode,
                operator=r.get("operator") or "",
                price_min_inr=r.get("price_min_inr") or 0,
                price_max_inr=r.get("price_max_inr") or 0,
                duration_minutes=r.get("duration_minutes"),
                departure_times=r.get("departure_times") or [],
                frequency=r.get("frequency") or "",
                booking_url=r.get("booking_url") or "",
                source=r.get("source") or "",
                data_freshness=r.get("scraped_at") or ""
            ))

    message = ""
    if scraping_in_progress:
        message = "Finding fresh transport options in background..."

    return TransportSearchResponse(
        origin=origin,
        destination=destination,
        options=grouped_options,
        scraping_in_progress=scraping_in_progress,
        data_freshness=data_freshness,
        message=message
    )

@router.post("/transport/trigger", status_code=202)
async def trigger_transport(
    body: TriggerRequest,
    background_tasks: BackgroundTasks,
    x_admin_secret: str = Header(..., alias="X-Admin-Secret")
):
    import os
    expected_secret = os.environ.get("ADMIN_SECRET", "")
    if not expected_secret or x_admin_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    background_tasks.add_task(bg_scrape_task, body.origin, body.destination)
    return {"message": "Scraping triggered successfully"}
