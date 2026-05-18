"""
Scraper management API endpoints.
"""
import asyncio
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from datetime import datetime
from scrapers.scheduler import DESTINATIONS, _resolve_destination_id, _run_smart_scraper_job
from core.supabase_client import db

router = APIRouter(prefix="/scraper", tags=["scraper"])


@router.get("/status")
async def get_scraper_status():
    """
    Get status of all destination scraper jobs.
    Returns last run time, record counts, and status for each destination.
    """
    status_list = []

    for dest in DESTINATIONS:
        dest_id = await _resolve_destination_id(dest["slug"])
        if not dest_id:
            continue

        try:
            dest_response = db.table("destinations").select(
                "scraped_at"
            ).eq("id", dest_id).execute()

            last_run = None
            if dest_response.data and dest_response.data[0].get("scraped_at"):
                last_scrape = dest_response.data[0]["scraped_at"]
                last_run = datetime.fromisoformat(last_scrape.replace("Z", "+00:00"))

            # Count records
            places_resp = db.table("places").select("id", count="exact").eq("destination_id", dest_id).execute()
            hotels_resp = db.table("hotels").select("id", count="exact").eq("destination_id", dest_id).execute()

            total_records = (places_resp.count or 0) + (hotels_resp.count or 0)

            # Next run is usually every 48h but calculating accurately depends on APScheduler API
            next_run = None
            if last_run:
                next_run = last_run.replace(hour=(last_run.hour + 48) % 24)

            status_list.append({
                "destination": dest["name"],
                "destination_slug": dest["slug"],
                "last_run": last_run.isoformat() if last_run else None,
                "records_count": total_records,
                "next_run": next_run.isoformat() if next_run else None,
                "status": "active",
            })

        except Exception as e:
            status_list.append({
                "destination": dest["name"],
                "destination_slug": dest["slug"],
                "status": "error",
                "error": str(e),
            })

    return {"jobs": status_list}


@router.post("/trigger/{destination_slug}")
async def trigger_scraper(
    destination_slug: str,
    x_admin_secret: Optional[str] = Header(None, alias="X-Admin-Secret")
):
    """
    Manually trigger SmartScraper for a specific destination.
    Requires X-Admin-Secret header matching ADMIN_SECRET env var.
    """
    from core.config import settings

    # Validate admin secret
    admin_secret = getattr(settings, "ADMIN_SECRET", "")
    if admin_secret and x_admin_secret != admin_secret:
        raise HTTPException(status_code=403, detail="Invalid admin secret")

    # Find destination
    dest = next((d for d in DESTINATIONS if d["slug"] == destination_slug), None)
    
    # If not in base 25, check DB
    if not dest:
        dest_response = db.table("destinations").select("*").eq("slug", destination_slug).execute()
        if dest_response.data:
            dest = dest_response.data[0]
            
    if not dest:
        raise HTTPException(status_code=404, detail=f"Destination '{destination_slug}' not found")

    # Run in background
    async def run_in_background():
        try:
            await _run_smart_scraper_job(dest)
        except Exception:
            pass  # Logged in the job function

    asyncio.create_task(run_in_background())

    return {
        "status": "accepted",
        "message": f"Triggered SmartScraper for {destination_slug}",
        "job_id": f"smartscrape_{destination_slug}",
    }