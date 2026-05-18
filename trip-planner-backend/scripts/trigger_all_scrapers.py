import asyncio
import argparse
import sys
import os

# Add parent dir to path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrapers.scheduler import DESTINATIONS, _run_smart_scraper_job
from core.supabase_client import db
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def trigger_all(destination_slug=None):
    if destination_slug:
        # Find in DESTINATIONS or DB
        dest = next((d for d in DESTINATIONS if d["slug"] == destination_slug), None)
        if not dest:
            dest_response = db.table("destinations").select("*").eq("slug", destination_slug).execute()
            if dest_response.data:
                dest = dest_response.data[0]
        
        if not dest:
            logger.error(f"Destination '{destination_slug}' not found.")
            return
            
        logger.info(f"Triggering scrape for {dest['name']} ({destination_slug})...")
        await _run_smart_scraper_job(dest)
        logger.info("Done.")
    else:
        logger.info(f"Triggering scrape for all {len(DESTINATIONS)} base destinations.")
        for i, dest in enumerate(DESTINATIONS):
            logger.info(f"[{i+1}/{len(DESTINATIONS)}] Triggering scrape for {dest['name']}...")
            await _run_smart_scraper_job(dest)
            
            if i < len(DESTINATIONS) - 1:
                logger.info("Waiting 60 seconds before next destination to respect rate limits...")
                await asyncio.sleep(60)
                
        logger.info("All scrapers finished.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trigger SmartScraper jobs manually.")
    parser.add_argument(
        "--destination", 
        type=str, 
        help="Specific destination slug to scrape (e.g. 'jaipur'). If omitted, runs all 25 base destinations."
    )
    args = parser.parse_args()
    
    asyncio.run(trigger_all(args.destination))
