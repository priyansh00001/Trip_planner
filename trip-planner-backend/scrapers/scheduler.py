"""
scrapers/scheduler.py — Always-on background scraper pipeline.

Replaces APScheduler with a pair of long-running asyncio tasks:
  • _destination_loop  — scrapes all destinations in priority batches, rolling
  • _transport_loop    — scrapes popular city-pair transport options every 12h
  • _watchdog          — restarts dead tasks every 5 min

Architecture:
  - Module-level singleton `pipeline` is imported by main.py lifespan
    and by routers/scraper.py for status / trigger endpoints.
  - Semaphore(3) is the ONLY Playwright concurrency guard; never launch
    BrowserAgent outside it.
  - Supabase client (`db`) is async (supabase-py v2 AsyncClient) so all
    DB calls use `await`.

Backward-compatible shim:
  start_scheduler() — kept so any stale imports don't break.
  DESTINATIONS list  — kept for any direct imports in tests/routers.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List

from scrapers.priority import (
    TRANSPORT_POPULAR_PAIRS,
    get_interval_hours,
    get_tier,
)
from core.event_bus import bus, ScraperEvent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static destination list (backward-compat; canonical list comes from DB)
# ---------------------------------------------------------------------------

DESTINATIONS = [
    {"slug": "jaipur",          "name": "Jaipur",                    "state": "Rajasthan",        "lat": 26.9124, "lon": 75.7873},
    {"slug": "udaipur",         "name": "Udaipur",                   "state": "Rajasthan",        "lat": 24.5854, "lon": 73.7125},
    {"slug": "jodhpur",         "name": "Jodhpur",                   "state": "Rajasthan",        "lat": 26.2389, "lon": 73.0243},
    {"slug": "jaisalmer",       "name": "Jaisalmer",                 "state": "Rajasthan",        "lat": 26.2976, "lon": 70.9178},
    {"slug": "pushkar",         "name": "Pushkar",                   "state": "Rajasthan",        "lat": 26.4897, "lon": 74.5501},
    {"slug": "goa-north",       "name": "Goa North (Calangute)",     "state": "Goa",              "lat": 15.542,  "lon": 73.7594},
    {"slug": "goa-south",       "name": "Goa South (Palolem)",       "state": "Goa",              "lat": 15.01,   "lon": 74.02},
    {"slug": "varkala",         "name": "Varkala",                   "state": "Kerala",           "lat": 8.7378,  "lon": 76.715},
    {"slug": "kovalam",         "name": "Kovalam",                   "state": "Kerala",           "lat": 8.393,   "lon": 76.978},
    {"slug": "munnar",          "name": "Munnar",                    "state": "Kerala",           "lat": 10.0889, "lon": 77.0595},
    {"slug": "coorg",           "name": "Coorg",                     "state": "Karnataka",        "lat": 12.3376, "lon": 75.8069},
    {"slug": "hampi",           "name": "Hampi",                     "state": "Karnataka",        "lat": 15.335,  "lon": 76.46},
    {"slug": "pondicherry",     "name": "Pondicherry",               "state": "Puducherry",       "lat": 11.9416, "lon": 79.8083},
    {"slug": "manali",          "name": "Manali",                    "state": "Himachal Pradesh", "lat": 32.2432, "lon": 77.1892},
    {"slug": "shimla",          "name": "Shimla",                    "state": "Himachal Pradesh", "lat": 31.1048, "lon": 77.1734},
    {"slug": "dharamshala",     "name": "Dharamshala",               "state": "Himachal Pradesh", "lat": 32.219,  "lon": 76.3234},
    {"slug": "spiti-valley",    "name": "Spiti Valley",              "state": "Himachal Pradesh", "lat": 32.45,   "lon": 78.05},
    {"slug": "darjeeling",      "name": "Darjeeling",                "state": "West Bengal",      "lat": 27.041,  "lon": 88.2619},
    {"slug": "gangtok",         "name": "Gangtok",                   "state": "Sikkim",           "lat": 27.3313, "lon": 88.6138},
    {"slug": "varanasi",        "name": "Varanasi",                  "state": "Uttar Pradesh",    "lat": 25.3176, "lon": 82.9739},
    {"slug": "agra",            "name": "Agra",                      "state": "Uttar Pradesh",    "lat": 27.1767, "lon": 78.0081},
    {"slug": "andaman-islands", "name": "Andaman Islands (Port Blair)", "state": "Andaman & Nicobar", "lat": 11.7181, "lon": 92.7206},
    {"slug": "kaziranga",       "name": "Kaziranga",                 "state": "Assam",            "lat": 26.5958, "lon": 93.1713},
    {"slug": "ranthambore",     "name": "Ranthambore",               "state": "Rajasthan",        "lat": 25.0202, "lon": 76.6019},
    {"slug": "jim-corbett",     "name": "Jim Corbett",               "state": "Uttarakhand",      "lat": 29.53,   "lon": 78.89},
]


# ---------------------------------------------------------------------------
# Backward-compat helper (used by routers/scraper.py legacy code)
# ---------------------------------------------------------------------------

async def _resolve_destination_id(slug: str) -> str | None:
    """Resolve destination ID from slug via Supabase."""
    from core.supabase_client import db
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: db.table("destinations").select("id").eq("slug", slug).execute()
        )
        if response.data:
            return response.data[0]["id"]
    except Exception as e:
        logger.warning(f"Failed to resolve destination_id for {slug}: {e}")
    return None


# ---------------------------------------------------------------------------
# ScraperPipeline
# ---------------------------------------------------------------------------

class ScraperPipeline:
    """
    Always-on background scraper pipeline.

    Starts two perpetual asyncio tasks on `start()`:
      • _destination_loop  — rolls through all destinations in priority order
      • _transport_loop    — scrapes popular city pairs for transport options
      • _watchdog          — keeps both loops alive if they ever die

    Thread-safety: all state is mutated only inside the asyncio event loop.
    """

    def __init__(self) -> None:
        self.running: bool = False
        # Max 3 concurrent Playwright browser instances
        self.semaphore = asyncio.Semaphore(3)
        # Max 2 concurrent transport Playwright instances (lower priority)
        self.transport_semaphore = asyncio.Semaphore(2)
        self._tasks: List[asyncio.Task] = []
        # slug → datetime of last completed scrape
        self._last_scraped: Dict[str, datetime] = {}
        # slug → {places, hotels, errors, last_run, status}
        self._stats: Dict[str, dict] = {}

    # ------------------------------------------------------------------
    # Public lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Called from main.py lifespan. Starts all background loops."""
        self.running = True
        self._tasks = [
            asyncio.create_task(self._destination_loop(), name="dest_pipeline"),
            asyncio.create_task(self._transport_loop(),   name="transport_pipeline"),
            asyncio.create_task(self._watchdog(),         name="watchdog"),
        ]
        logger.info("ScraperPipeline started — 3 background tasks running")

    async def stop(self) -> None:
        """Called from main.py lifespan on shutdown."""
        self.running = False
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        logger.info("ScraperPipeline stopped")

    # ------------------------------------------------------------------
    # Destination loop
    # ------------------------------------------------------------------

    async def _destination_loop(self) -> None:
        """
        Continuously scrapes all destinations in priority order.

        One full cycle = all active destinations attempted (skipped if scraped
        recently enough for their tier).  After the cycle completes, sleep
        30 min then start the next cycle.
        """
        while self.running:
            try:
                destinations = await self._fetch_active_destinations()

                # Sort: Tier 1 first, then within tier by oldest-scraped-first
                destinations.sort(key=lambda d: (
                    get_tier(d["slug"]),
                    self._last_scraped.get(d["slug"], datetime.min),
                ))

                logger.info(f"Cycle start — {len(destinations)} destinations queued")
                await bus.emit(ScraperEvent(
                    type="cycle_start",
                    detail=f"{len(destinations)} destinations queued",
                ))

                # Process in batches of 3 (matches semaphore limit)
                batch_size = 3
                for i in range(0, len(destinations), batch_size):
                    if not self.running:
                        break
                    batch = destinations[i : i + batch_size]
                    logger.info(f"Batch {i//batch_size + 1}: {[d['name'] for d in batch]}")
                    await asyncio.gather(*[
                        self._scrape_destination_safe(dest)
                        for dest in batch
                    ])
                    # Polite gap between batches to avoid overwhelming services
                    if self.running:
                        await asyncio.sleep(30)

                logger.info("Cycle complete. Next in 30 min.")
                await bus.emit(ScraperEvent(
                    type="cycle_end",
                    detail="Sleeping 30 min",
                ))
                await asyncio.sleep(1800)  # 30 min before next full cycle

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"ScraperPipeline: Destination loop error: {e}", exc_info=True)
                await asyncio.sleep(300)  # 5 min backoff on unexpected error

    async def _scrape_destination_safe(self, dest: dict) -> None:
        """Scrape one destination, respecting semaphore and staleness checks."""
        slug = dest["slug"]
        interval_hours = get_interval_hours(slug)
        last = self._last_scraped.get(slug)

        # Skip if scraped recently enough for this tier
        if last is not None:
            age_hours = (datetime.utcnow() - last).total_seconds() / 3600
            if age_hours < interval_hours:
                logger.debug(
                    f"ScraperPipeline: Skip {slug} — scraped {age_hours:.1f}h ago "
                    f"(interval {interval_hours}h)"
                )
                return

        async with self.semaphore:
            try:
                logger.info(
                    f"ScraperPipeline: Scraping {dest['name']} (Tier {get_tier(slug)})"
                )
                from scrapers.smart_scraper import SmartScraper

                scraper = SmartScraper()
                bundle = await scraper.scrape_destination(dest, max_sites=3)

                # Persist records to Supabase
                dest_id = dest.get("id")
                if dest_id:
                    records = bundle.to_db_records()
                    for table, data in records.items():
                        if data:
                            for rec in data:
                                rec["destination_id"] = dest_id
                            await self._upsert_records(table, data)

                # Update in-memory tracking
                self._last_scraped[slug] = datetime.utcnow()
                self._stats[slug] = {
                    "places":    len(bundle.places),
                    "hotels":    len(bundle.hotels),
                    "insights":  len(bundle.local_insights),
                    "sources":   bundle.sources_scraped,
                    "last_run":  datetime.utcnow().isoformat(),
                    "status":    "ok",
                }

                # Write quality score + scraped_at back to destinations table
                if dest_id:
                    await self._update_quality_score(dest_id, bundle)

                logger.info(
                    f"ScraperPipeline: Done {dest['name']} — "
                    f"{len(bundle.places)} places, {len(bundle.hotels)} hotels"
                )

            except Exception as e:
                logger.error(
                    f"ScraperPipeline: Failed scraping {slug}: {e}", exc_info=True
                )
                self._stats[slug] = {
                    "last_run": datetime.utcnow().isoformat(),
                    "status":   "error",
                    "error":    str(e),
                }

    # ------------------------------------------------------------------
    # Transport loop
    # ------------------------------------------------------------------

    async def _transport_loop(self) -> None:
        """
        Continuously scrapes popular city pairs for transport options.
        Runs independently from the destination loop.
        Full cycle → sleep 12 hours → next cycle.
        """
        while self.running:
            try:
                logger.info(
                    f"ScraperPipeline: Starting transport cycle — "
                    f"{len(TRANSPORT_POPULAR_PAIRS)} pairs"
                )

                for origin, dest in TRANSPORT_POPULAR_PAIRS:
                    if not self.running:
                        break
                    async with self.transport_semaphore:
                        try:
                            from scrapers.transport_scraper import TransportScraper

                            scraper = TransportScraper()
                            results = await scraper._scrape_pair(origin, dest)
                            if results:
                                dest_slug = dest.lower().replace(" ", "-")
                                await scraper.save_to_db(results, dest_slug)
                                logger.info(
                                    f"ScraperPipeline: Transport {origin}→{dest}: "
                                    f"{len(results)} options saved"
                                )
                        except Exception as e:
                            logger.error(
                                f"ScraperPipeline: Transport {origin}→{dest} failed: {e}"
                            )
                        # Polite delay between pairs to avoid rate limiting
                        await asyncio.sleep(15)

                logger.info(
                    "ScraperPipeline: Transport cycle complete. Sleeping 12 hours."
                )
                await asyncio.sleep(43200)  # 12 hours

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"ScraperPipeline: Transport loop error: {e}", exc_info=True)
                await asyncio.sleep(600)  # 10 min backoff

    # ------------------------------------------------------------------
    # Watchdog
    # ------------------------------------------------------------------

    async def _watchdog(self) -> None:
        """
        Every 5 minutes, check that dest + transport tasks are still alive.
        If either died unexpectedly, restart it.
        """
        while self.running:
            await asyncio.sleep(300)  # check every 5 min
            try:
                # Only watch the first two tasks (dest + transport, not watchdog itself)
                for i, task in enumerate(self._tasks[:2]):
                    if task.done() and not task.cancelled():
                        task_name = task.get_name()
                        logger.warning(
                            f"ScraperPipeline: Task '{task_name}' died unexpectedly. "
                            "Restarting..."
                        )
                        if "dest" in task_name:
                            new_task = asyncio.create_task(
                                self._destination_loop(), name="dest_pipeline"
                            )
                        else:
                            new_task = asyncio.create_task(
                                self._transport_loop(), name="transport_pipeline"
                            )
                        self._tasks[i] = new_task
            except Exception as e:
                logger.error(f"ScraperPipeline: Watchdog error: {e}")

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

    async def _fetch_active_destinations(self) -> list[dict]:
        """Return all is_active destinations from Supabase."""
        from core.supabase_client import db
        import asyncio
        loop = asyncio.get_event_loop()
        try:
            result = await loop.run_in_executor(
                None,
                lambda: db.table("destinations")
                    .select("id, name, slug, lat, lon, state")
                    .eq("is_active", True)
                    .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"ScraperPipeline: Failed to fetch destinations: {e}")
            # Fall back to static list (no IDs — quality_score won't be updated)
            return [d.copy() for d in DESTINATIONS]

    async def _upsert_records(self, table: str, records: list[dict]) -> None:
        """Upsert a batch of records to a Supabase table (sync client via executor)."""
        from core.supabase_client import db
        from datetime import timezone
        import asyncio

        now = datetime.now(timezone.utc).isoformat()
        for rec in records:
            rec.setdefault("scraped_at", now)

        conflict_cols = {
            "places":           ["destination_id", "name"],
            "hotels":           ["name", "destination_id", "source"],
            "local_events":     ["destination_id", "name", "start_date"],
            "blogs_and_guides": ["destination_id", "url"],
        }
        cols = conflict_cols.get(table, ["id"])

        # Deduplicate records by unique conflict keys to avoid PG error 21000
        if table in conflict_cols:
            deduped = {}
            for rec in records:
                key = tuple(rec.get(col) for col in cols)
                deduped[key] = rec
            records = list(deduped.values())

        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                lambda: db.table(table)
                    .upsert(records, on_conflict=",".join(cols))
                    .execute()
            )
            logger.info(
                f"ScraperPipeline: Upserted {len(records)} records to {table}"
            )
        except Exception as e:
            logger.error(f"ScraperPipeline: Upsert to '{table}' failed: {e}")

    async def _update_quality_score(self, dest_id: str, bundle) -> None:
        """Compute score and write data_quality_score + scraped_at to destinations."""
        from core.supabase_client import db
        from datetime import timezone
        import asyncio

        score = min(
            len(bundle.places) * 5
            + len(bundle.hotels) * 4
            + len(bundle.local_insights) * 3,
            100,
        )
        payload: dict = {
            "data_quality_score": score,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }
        if bundle.best_months:
            payload["best_months"] = bundle.best_months
        if bundle.avg_daily_budget_inr:
            payload["avg_daily_budget_inr"] = bundle.avg_daily_budget_inr

        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                lambda: db.table("destinations")
                    .update(payload)
                    .eq("id", dest_id)
                    .execute()
            )
        except Exception as e:
            logger.warning(f"ScraperPipeline: Quality score update failed: {e}")

    # ------------------------------------------------------------------
    # Public API (for routers)
    # ------------------------------------------------------------------

    def get_status(self) -> dict:
        """Return pipeline health + per-destination stats. Called by /api/scraper/status."""
        return {
            "running": self.running,
            "tasks": [
                {"name": t.get_name(), "alive": not t.done()}
                for t in self._tasks
            ],
            "destinations": {k: dict(v) for k, v in self._stats.items()},
            "last_scraped": {
                k: v.isoformat()
                for k, v in self._last_scraped.items()
            },
        }

    async def trigger_destination(self, slug: str) -> None:
        """Force immediate re-scrape of one destination (ignores staleness check)."""
        destinations = await self._fetch_active_destinations()
        dest = next((d for d in destinations if d["slug"] == slug), None)
        if not dest:
            # Also check static fallback list (covers slugs before DB insert)
            dest = next((d for d in DESTINATIONS if d["slug"] == slug), None)
        if not dest:
            raise ValueError(f"Destination not found: {slug}")
        # Clear last_scraped so staleness check passes immediately
        self._last_scraped.pop(slug, None)
        asyncio.create_task(self._scrape_destination_safe(dest))


# ---------------------------------------------------------------------------
# Module-level singleton — imported by main.py and routers/scraper.py
# ---------------------------------------------------------------------------

pipeline = ScraperPipeline()


# ---------------------------------------------------------------------------
# Backward-compat shim — kept so any stale imports don't raise ImportError
# ---------------------------------------------------------------------------

def start_scheduler():
    """
    Kept for backward compatibility.
    Actual startup happens in main.py lifespan via `await pipeline.start()`.
    Returns the pipeline singleton.
    """
    return pipeline