# IMPLEMENTATION NOTE:
# On-demand scraper triggered when a user searches for a destination not in DB.
# Uses Nominatim (free, no key) for geocoding, then creates a minimal destination
# record and kicks off a background SmartScraper job (fire-and-forget).

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import httpx
from slugify import slugify

from scrapers.smart_scraper import SmartScraper, ScrapedBundle

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_HEADERS = {
    "User-Agent": "TripPlannerApp/1.0 (educational project)"
}


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class OnDemandResult:
    found: bool
    from_db: bool = False
    destination: Optional[dict] = None
    scraping_in_progress: bool = False
    is_international: bool = False
    message: str = ""


# ---------------------------------------------------------------------------
# OnDemandScraper
# ---------------------------------------------------------------------------

class OnDemandScraper:
    """
    Handles discovery of unknown destinations.
    Geocodes with Nominatim → checks DB → inserts minimal record →
    fires background SmartScraper (never awaited by caller).
    """

    async def handle_unknown_destination(self, location_query: str) -> OnDemandResult:
        """
        Full pipeline:
        1. Geocode with Nominatim
        2. Extract name/state/country
        3. Re-check DB with clean name
        4. Insert minimal destination record
        5. Fire background scrape (create_task — no await)
        6. Return immediately with scraping_in_progress=True
        """
        from core.supabase_client import db

        # --- Step 1: Geocode ---
        geo = await self._geocode(location_query)
        if not geo:
            return OnDemandResult(found=False, message=f"Could not locate '{location_query}'.")

        # --- Step 2: Extract metadata ---
        address = geo.get("address", {})
        name = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("county")
            or geo.get("display_name", "").split(",")[0].strip()
        )
        state = address.get("state", "")
        country = address.get("country", "")
        lat = float(geo.get("lat", 0))
        lon = float(geo.get("lon", 0))
        is_international = country.lower() not in ("india", "")

        if not name:
            return OnDemandResult(found=False, message="Could not determine destination name.")

        dest_slug = slugify(name)

        # --- Step 3: Re-check DB with clean name ---
        try:
            existing = db.table("destinations").select("*").eq("slug", dest_slug).execute()
            if existing.data:
                row = existing.data[0]
                return OnDemandResult(
                    found=True,
                    from_db=True,
                    destination=row,
                    message=f"Found {row['name']} in database.",
                    is_international=is_international,
                )
        except Exception as e:
            logger.warning(f"OnDemandScraper: DB check failed: {e}")

        # --- Step 4: Insert minimal destination record ---
        minimal_record = {
            "name": name,
            "slug": dest_slug,
            "state": state,
            "lat": lat,
            "lon": lon,
            "is_active": False,
            "data_quality_score": 0,
        }

        destination_record = minimal_record.copy()
        try:
            resp = db.table("destinations").upsert(
                minimal_record,
                on_conflict="slug",
                returning="representation",
            ).execute()
            if resp.data:
                destination_record = resp.data[0]
        except Exception as e:
            logger.error(f"OnDemandScraper: Failed to insert destination record: {e}")
            # Continue — we can still return found=True with geocoded data

        # --- Step 5: Fire background scrape (fire-and-forget) ---
        asyncio.create_task(self._background_scrape(destination_record))

        # --- Step 6: Return immediately ---
        return OnDemandResult(
            found=True,
            from_db=False,
            destination=destination_record,
            scraping_in_progress=True,
            is_international=is_international,
            message=f"Found {name}. Gathering detailed information in background.",
        )

    async def _background_scrape(self, destination: dict):
        """
        Background job: scrape via pipeline (respects semaphore) or direct
        SmartScraper if the destination isn't active in DB yet.

        Fire-and-forget — caller does not await this.
        """
        from core.supabase_client import db

        dest_name = destination.get("name", "unknown")
        dest_slug = destination.get("slug", "")
        dest_id   = destination.get("id")
        logger.info(f"OnDemandScraper: Starting background scrape for {dest_name}")

        try:
            # Try to route through the pipeline singleton so the global
            # Semaphore(3) is respected and Playwright instances are capped.
            from scrapers.scheduler import pipeline
            try:
                await pipeline.trigger_destination(dest_slug)
                logger.info(
                    f"OnDemandScraper: Handed {dest_name} to pipeline for scraping"
                )
                return
            except ValueError:
                # Destination not yet in active DB list (just inserted as
                # is_active=False) — fall through to direct scrape below.
                logger.info(
                    f"OnDemandScraper: {dest_name} not in pipeline yet; "
                    "running direct SmartScraper"
                )

            # Direct scrape (new destination, not yet in active list)
            smart = SmartScraper()
            bundle: ScrapedBundle = await smart.scrape_destination(
                destination, max_sites=3
            )

            # Save all records
            records_map = bundle.to_db_records()
            for table, records in records_map.items():
                if records and dest_id:
                    for rec in records:
                        rec["destination_id"] = dest_id
                    await self._upsert_records(table, records)

            # Update destination record
            score = self._calculate_quality_score(bundle)
            update_payload = {
                "data_quality_score": score,
                "is_active": score > 30,
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
            if bundle.best_months:
                update_payload["best_months"] = bundle.best_months
            if bundle.avg_daily_budget_inr:
                update_payload["avg_daily_budget_inr"] = bundle.avg_daily_budget_inr

            if dest_id:
                try:
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(
                        None,
                        lambda: db.table("destinations")
                            .update(update_payload)
                            .eq("id", dest_id)
                            .execute()
                    )
                    logger.info(
                        f"OnDemandScraper: {dest_name} quality score={score}, "
                        f"is_active={score > 30}"
                    )
                except Exception as e:
                    logger.error(
                        f"OnDemandScraper: Failed to update destination record: {e}"
                    )

            # Rebuild FAISS indexes
            try:
                from rag.faiss_index import rebuild_indexes_from_db
                rebuild_indexes_from_db()
            except Exception as e:
                logger.warning(
                    f"OnDemandScraper: FAISS rebuild failed (non-fatal): {e}"
                )

        except Exception as e:
            logger.error(
                f"OnDemandScraper: Background scrape failed for {dest_name}: {e}",
                exc_info=True,
            )


    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _geocode(self, query: str) -> Optional[dict]:
        """Call Nominatim to geocode a free-form location query."""
        params = {
            "q": query,
            "format": "json",
            "limit": 1,
            "addressdetails": 1,
            "extratags": 1,
        }
        try:
            async with httpx.AsyncClient(
                timeout=10.0, headers=NOMINATIM_HEADERS
            ) as client:
                resp = await client.get(NOMINATIM_URL, params=params)
                resp.raise_for_status()
                data = resp.json()
                return data[0] if data else None
        except Exception as e:
            logger.error(f"OnDemandScraper: Nominatim geocoding failed: {e}")
            return None

    async def _upsert_records(self, table: str, records: list[dict]):
        """Upsert records to Supabase via the BaseScraper upsert helper."""
        from scrapers.base import BaseScraper
        from datetime import datetime, timezone

        # Inject scraped_at timestamp
        now = datetime.now(timezone.utc).isoformat()
        for rec in records:
            rec.setdefault("scraped_at", now)

        conflict_cols = {
            "places": ["destination_id", "name"],
            "hotels": ["name", "destination_id", "source"],
            "local_events": ["destination_id", "name", "start_date"],
            "blogs_and_guides": ["destination_id", "url"],
        }
        cols = conflict_cols.get(table, ["id"])

        from core.supabase_client import db
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: db.table(table).upsert(records, on_conflict=",".join(cols)).execute()
            )
            logger.info(f"OnDemandScraper: Upserted {len(records)} records to {table}")
        except Exception as e:
            logger.error(f"OnDemandScraper: Upsert to {table} failed: {e}")

    def _calculate_quality_score(self, bundle: ScrapedBundle) -> int:
        """Score 0-100 based on how much data was retrieved."""
        score = 0
        score += min(len(bundle.places) * 5, 40)           # max 40 pts
        score += min(len(bundle.hotels) * 4, 20)            # max 20 pts
        score += min(len(bundle.local_insights) * 3, 15)    # max 15 pts
        score += 10 if bundle.best_months else 0
        score += 10 if bundle.avg_daily_budget_inr else 0
        score += min(len(bundle.events) * 3, 15)            # max 15 pts
        return min(score, 100)
