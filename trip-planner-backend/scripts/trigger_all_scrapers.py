"""
Manual trigger script for the ScraperPipeline.

Usage:
  python scripts/trigger_all_scrapers.py                     # scrape all 25 base destinations
  python scripts/trigger_all_scrapers.py --destination jaipur # scrape one destination
"""

import asyncio
import argparse
import sys
import os

# Add parent dir to path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scrapers.scheduler import pipeline, DESTINATIONS
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def trigger_all(destination_slug=None):
    """Trigger scrapes via the pipeline singleton (respects semaphore)."""
    # Start the pipeline so semaphores and tasks are initialized
    await pipeline.start()

    try:
        if destination_slug:
            logger.info(f"Triggering scrape for '{destination_slug}'...")
            try:
                await pipeline.trigger_destination(destination_slug)
            except ValueError as e:
                logger.error(str(e))
                return
            # Wait a bit for the fire-and-forget task to complete
            logger.info("Waiting for background scrape to finish...")
            await asyncio.sleep(120)
            logger.info("Done.")
        else:
            logger.info(f"Triggering scrape for all {len(DESTINATIONS)} base destinations.")
            for i, dest in enumerate(DESTINATIONS):
                slug = dest["slug"]
                logger.info(f"[{i+1}/{len(DESTINATIONS)}] Scraping {dest['name']} ({slug})...")
                pipeline._last_scraped.pop(slug, None)  # force staleness check to pass
                await pipeline._scrape_destination_safe(dest)

                if i < len(DESTINATIONS) - 1:
                    logger.info("Waiting 30 seconds before next destination...")
                    await asyncio.sleep(30)

            logger.info("All scrapers finished.")
    finally:
        await pipeline.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Trigger SmartScraper jobs manually via pipeline.")
    parser.add_argument(
        "--destination",
        type=str,
        help="Specific destination slug to scrape (e.g. 'jaipur'). If omitted, runs all 25 base destinations."
    )
    args = parser.parse_args()

    asyncio.run(trigger_all(args.destination))
