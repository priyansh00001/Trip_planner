# IMPLEMENTATION NOTE:
# APScheduler-based scheduler for running scrapers at configured intervals.
# Uses SmartScraper to periodically refresh data for known destinations.
# Staggers jobs by 60s to avoid hammering APIs or hitting rate limits.

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Base 25 Indian destinations
DESTINATIONS = [
    {"slug": "jaipur", "name": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lon": 75.7873},
    {"slug": "udaipur", "name": "Udaipur", "state": "Rajasthan", "lat": 24.5854, "lon": 73.7125},
    {"slug": "jodhpur", "name": "Jodhpur", "state": "Rajasthan", "lat": 26.2389, "lon": 73.0243},
    {"slug": "jaisalmer", "name": "Jaisalmer", "state": "Rajasthan", "lat": 26.2976, "lon": 70.9178},
    {"slug": "pushkar", "name": "Pushkar", "state": "Rajasthan", "lat": 26.4897, "lon": 74.5501},
    {"slug": "goa-north", "name": "Goa North (Calangute)", "state": "Goa", "lat": 15.542, "lon": 73.7594},
    {"slug": "goa-south", "name": "Goa South (Palolem)", "state": "Goa", "lat": 15.01, "lon": 74.02},
    {"slug": "varkala", "name": "Varkala", "state": "Kerala", "lat": 8.7378, "lon": 76.715},
    {"slug": "kovalam", "name": "Kovalam", "state": "Kerala", "lat": 8.393, "lon": 76.978},
    {"slug": "munnar", "name": "Munnar", "state": "Kerala", "lat": 10.0889, "lon": 77.0595},
    {"slug": "coorg", "name": "Coorg", "state": "Karnataka", "lat": 12.3376, "lon": 75.8069},
    {"slug": "hampi", "name": "Hampi", "state": "Karnataka", "lat": 15.335, "lon": 76.46},
    {"slug": "pondicherry", "name": "Pondicherry", "state": "Puducherry", "lat": 11.9416, "lon": 79.8083},
    {"slug": "manali", "name": "Manali", "state": "Himachal Pradesh", "lat": 32.2432, "lon": 77.1892},
    {"slug": "shimla", "name": "Shimla", "state": "Himachal Pradesh", "lat": 31.1048, "lon": 77.1734},
    {"slug": "dharamshala", "name": "Dharamshala", "state": "Himachal Pradesh", "lat": 32.219, "lon": 76.3234},
    {"slug": "spiti-valley", "name": "Spiti Valley", "state": "Himachal Pradesh", "lat": 32.45, "lon": 78.05},
    {"slug": "darjeeling", "name": "Darjeeling", "state": "West Bengal", "lat": 27.041, "lon": 88.2619},
    {"slug": "gangtok", "name": "Gangtok", "state": "Sikkim", "lat": 27.3313, "lon": 88.6138},
    {"slug": "varanasi", "name": "Varanasi", "state": "Uttar Pradesh", "lat": 25.3176, "lon": 82.9739},
    {"slug": "agra", "name": "Agra", "state": "Uttar Pradesh", "lat": 27.1767, "lon": 78.0081},
    {"slug": "andaman-islands", "name": "Andaman Islands (Port Blair)", "state": "Andaman & Nicobar", "lat": 11.7181, "lon": 92.7206},
    {"slug": "kaziranga", "name": "Kaziranga", "state": "Assam", "lat": 26.5958, "lon": 93.1713},
    {"slug": "ranthambore", "name": "Ranthambore", "state": "Rajasthan", "lat": 25.0202, "lon": 76.6019},
    {"slug": "jim-corbett", "name": "Jim Corbett", "state": "Uttarakhand", "lat": 29.53, "lon": 78.89},
]


async def _resolve_destination_id(slug: str) -> str | None:
    """Resolve destination ID from slug via Supabase."""
    from core.supabase_client import db
    try:
        response = db.table("destinations").select("id").eq("slug", slug).execute()
        if response.data:
            return response.data[0]["id"]
    except Exception as e:
        logger.warning(f"Failed to resolve destination_id for {slug}: {e}")
    return None


async def _run_smart_scraper_job(destination: dict):
    """Execute a single SmartScraper job for a destination."""
    from scrapers.on_demand import OnDemandScraper

    dest_name = destination.get("name", "unknown")
    dest_slug = destination.get("slug", "unknown")

    logger.info(f"Starting SmartScraper job for {dest_name}")

    try:
        destination_id = await _resolve_destination_id(dest_slug)
        if not destination_id:
            logger.warning(f"Could not resolve destination_id for {dest_slug}, skipping")
            return

        destination_with_id = {**destination, "id": destination_id}
        
        # We can just reuse OnDemandScraper's background job logic
        # since it already handles scraping, db upserts, and quality score update
        on_demand = OnDemandScraper()
        await on_demand._background_scrape(destination_with_id)
        
        logger.info(f"Completed SmartScraper job for {dest_name}")

    except Exception as e:
        logger.error(f"SmartScraper job failed for {dest_name}: {e}")


def register_all_scrapers(scheduler: AsyncIOScheduler):
    """Register one scheduled job per destination, staggered by 60s."""
    interval_hours = 48  # scrape every 2 days
    base_delay_seconds = 60  # staggered start to avoid rate limits

    for i, dest in enumerate(DESTINATIONS):
        start_delay_seconds = i * base_delay_seconds
        job_id = f"smartscrape_{dest['slug']}"

        job_func = lambda dst=dest: asyncio.create_task(_run_smart_scraper_job(dst))

        scheduler.add_job(
            job_func,
            trigger=IntervalTrigger(hours=interval_hours),
            id=job_id,
            name=f"SmartScrape - {dest['name']}",
            next_run_time=datetime.now() + timedelta(seconds=start_delay_seconds),
            replace_existing=True,
        )

        logger.info(f"Registered job: {job_id} (interval: {interval_hours}h, start_delay: {start_delay_seconds}s)")


async def startup_priority_run():
    """On app start, check if any active destinations haven't been scraped in 48h."""
    from core.supabase_client import db
    logger.info("Running startup priority check for destinations...")

    max_age_hours = 48
    
    try:
        # Fetch all active destinations
        response = db.table("destinations").select("*").eq("is_active", True).execute()
        active_dests = response.data or []
        
        delay = 10
        for dest in active_dests:
            should_run = True
            if dest.get("scraped_at"):
                last_scrape = datetime.fromisoformat(dest["scraped_at"].replace("Z", "+00:00"))
                age_hours = (datetime.now(timezone.utc) - last_scrape).total_seconds() / 3600
                should_run = age_hours > max_age_hours
                
            if should_run:
                logger.info(f"Priority run queued for {dest['name']} (delay: {delay}s)")
                
                async def delayed_run(d, wait_sec):
                    await asyncio.sleep(wait_sec)
                    await _run_smart_scraper_job(d)
                
                asyncio.create_task(delayed_run(dest, delay))
                delay += 60  # Stagger 60s
                
    except Exception as e:
        logger.error(f"Priority check failed: {e}")

async def _run_transport_scraper_job(destination: dict):
    from scrapers.transport_scraper import TransportScraper
    dest_name = destination.get("name", "unknown")
    logger.info(f"Starting TransportScraper job for {dest_name}")
    try:
        scraper = TransportScraper()
        records = await scraper.scrape(destination)
        dest_slug = destination.get("slug", dest_name.lower().replace(" ", "-"))
        await scraper.save_to_db(records, dest_slug)
        logger.info(f"Completed TransportScraper job for {dest_name}")
    except Exception as e:
        logger.error(f"TransportScraper job failed for {dest_name}: {e}")

def register_transport_scrapers(scheduler: AsyncIOScheduler):
    interval_hours = 12
    base_delay_seconds = 60

    for i, dest in enumerate(DESTINATIONS):
        # start after the main destination scrapers to lower priority interference
        start_delay_seconds = (i * base_delay_seconds) + 3600 
        job_id = f"transportscrape_{dest['slug']}"

        job_func = lambda dst=dest: asyncio.create_task(_run_transport_scraper_job(dst))

        scheduler.add_job(
            job_func,
            trigger=IntervalTrigger(hours=interval_hours),
            id=job_id,
            name=f"TransportScrape - {dest['name']}",
            next_run_time=datetime.now() + timedelta(seconds=start_delay_seconds),
            replace_existing=True,
        )
        logger.info(f"Registered job: {job_id} (interval: {interval_hours}h, start_delay: {start_delay_seconds}s)")


def start_scheduler() -> AsyncIOScheduler:
    """Create and configure the scheduler."""
    scheduler = AsyncIOScheduler(timezone="UTC")

    register_all_scrapers(scheduler)
    register_transport_scrapers(scheduler)

    scheduler.add_job(
        startup_priority_run,
        id="startup_priority",
        name="Startup Priority Scraping",
        next_run_time=datetime.now() + timedelta(seconds=10),
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started with all SmartScraper jobs")
    return scheduler