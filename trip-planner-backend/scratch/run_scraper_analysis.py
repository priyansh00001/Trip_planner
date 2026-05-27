import asyncio
import httpx
import json
import logging
import sys
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ScraperTest")

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from scrapers.transport_seed import SEED_DATA

ROUTES_TO_TEST = [
    # Popular routes (likely to have seed data)
    ("Delhi", "Jaipur"),
    ("Mumbai", "Goa"),
    ("Bangalore", "Mysore"),
    ("Delhi", "Mumbai"),
    
    # Obscure/Random routes (unlikely to have seed data, will heavily rely on live scraping / cab)
    ("Guwahati", "Shillong"),
    ("Bhopal", "Indore"),
    ("Coimbatore", "Ooty"),
    ("Kochi", "Munnar"),
    ("Dehradun", "Mussoorie")
]

BASE_URL = "http://localhost:8000"

async def run_tests():
    results = []
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for origin, destination in ROUTES_TO_TEST:
            logger.info(f"\n--- Testing Route: {origin} -> {destination} ---")
            
            # 1. Check if it has seed data
            has_seed = False
            for (seed_org, seed_dest) in SEED_DATA.keys():
                if (origin.lower() == seed_org.lower() and destination.lower() == seed_dest.lower()) or \
                   (origin.lower() == seed_dest.lower() and destination.lower() == seed_org.lower()):
                    has_seed = True
                    break
                    
            # 2. Hit the real-time endpoint on the LIVE server
            try:
                logger.info("Initiating scrape request to running server (localhost:8000)...")
                response = await client.post(
                    f"{BASE_URL}/api/transport/scrape-now", 
                    json={"origin": origin, "destination": destination}
                )
                
                raw_text = response.text
                
                live_modes_found = []
                seed_modes_found = []
                failed_modes = []
                
                for line in raw_text.splitlines():
                    if line.startswith("data:"):
                        try:
                            data = json.loads(line[5:].strip())
                            event_type = data.get("type")
                            
                            if event_type == "live_data":
                                live_modes_found.append(data.get("mode"))
                            elif event_type == "seed_data" or event_type == "estimated":
                                seed_modes_found.append(data.get("mode"))
                            elif event_type == "mode_failed":
                                failed_modes.append(data.get("mode"))
                        except json.JSONDecodeError:
                            pass
                            
                live_modes_found = list(set(live_modes_found))
                seed_modes_found = list(set(seed_modes_found))
                failed_modes = list(set(failed_modes))
                
                logger.info(f"Live data found for: {live_modes_found}")
                logger.info(f"Seed/Estimates used for: {seed_modes_found}")
                logger.info(f"Failed modes: {failed_modes}")
                
                results.append({
                    "origin": origin,
                    "destination": destination,
                    "has_seed_fallback": has_seed,
                    "live_scrape_success_modes": live_modes_found,
                    "seed_or_estimated_modes": seed_modes_found,
                    "failed_modes": failed_modes
                })
                
            except Exception as e:
                logger.error(f"Error testing {origin}->{destination}: {e}")
                
            # Sleep to avoid rate limits on Google
            await asyncio.sleep(6)
            
    # Write report
    report_lines = [
        "# Real-time Scraper vs Fallback Analysis",
        "",
        "This report outlines how often the live Google scraping succeeds versus when the system falls back to seed data or estimated calculations.",
        "",
        "## Test Results Summary",
        "",
        "| Route | Has Seed in DB? | Live Scrape Succeeded | Fallback Used | Failed Modes |",
        "|-------|-----------------|-----------------------|---------------|--------------|"
    ]
    
    total_routes = len(results)
    live_scrapes_succeeded = 0
    fallbacks_used = 0
    
    for r in results:
        live_modes = ", ".join(r["live_scrape_success_modes"]) or "None"
        fallback_modes = ", ".join(r["seed_or_estimated_modes"]) or "None"
        failed_modes = ", ".join(r["failed_modes"]) or "None"
        
        if r["live_scrape_success_modes"]:
            live_scrapes_succeeded += 1
        if r["seed_or_estimated_modes"]:
            fallbacks_used += 1
            
        report_lines.append(
            f"| {r['origin']} -> {r['destination']} | {'Yes' if r['has_seed_fallback'] else 'No'} | {live_modes} | {fallback_modes} | {failed_modes} |"
        )
        
    if total_routes == 0:
        logger.error("No results found. Server might be down.")
        return

    report_lines.extend([
        "",
        "## Metrics",
        f"- **Total Routes Tested:** {total_routes}",
        f"- **Routes with at least one LIVE scrape success:** {live_scrapes_succeeded} ({round(live_scrapes_succeeded/total_routes*100)}%)",
        f"- **Routes using Fallback (Seed/Cab):** {fallbacks_used} ({round(fallbacks_used/total_routes*100)}%)",
        "",
        "### Notes on Behaviour",
        "- For routes with **known seed data**, the system instantly shows the seed data (Fallback Used = flight/train/bus), and in the background, the scraper tries to find live data.",
        "- For **obscure routes**, seed data is missing, so it immediately relies on a **Calculated Cab Estimate** (`cab`) while the Google scraper attempts to find live results.",
        "- If Google Flights/Trains returns results, they are pushed as `live_data`.",
        "- Sometimes, Google Search blocks automated requests or the LLM parsing fails, resulting in `mode_failed`. The robust fallback mechanism ensures the UI never breaks and the user always sees at least a cab estimate or historical seed data."
    ])
    
    report_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "scraper_report.md"))
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
        
    print(f"Report generated at {report_path}")

if __name__ == "__main__":
    asyncio.run(run_tests())
