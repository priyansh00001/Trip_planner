# IMPLEMENTATION NOTE:
# Smart scraper orchestrator — coordinates BrowserAgent across multiple
# sites in parallel for a given destination.
# Uses asyncio.gather(return_exceptions=True) for fault-tolerant parallel scraping.
# Deduplicates places/hotels using difflib fuzzy matching (cutoff 0.85).
#
# FIX 3A — Quality-aware source selection: only count site as scraped if
#           BrowserAgent rated it "medium" or "high". Low/skipped → failed.
# FIX 3B — Holidify direct-URL scraping added as top-priority source.
# FIX 3D — Post-bundle geocoding: Nominatim fills lat/lon for places
#           that have area info but no coordinates.
# FIX 3E — data_quality_score written to destinations table after every run.

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Optional

import httpx

from scrapers.browser_agent import BrowserAgent
from scrapers.site_configs import get_configs_for_data_types
from core.event_bus import bus, ScraperEvent

logger = logging.getLogger(__name__)

NOMINATIM_HEADERS = {"User-Agent": "TripPlannerApp/1.0 (educational project)"}

# ---------------------------------------------------------------------------
# Result bundle
# ---------------------------------------------------------------------------

@dataclass
class ScrapedBundle:
    destination_name: str
    places: list = field(default_factory=list)
    hotels: list = field(default_factory=list)
    local_insights: list = field(default_factory=list)
    events: list = field(default_factory=list)
    best_months: list = field(default_factory=list)
    avg_daily_budget_inr: dict = field(default_factory=dict)
    sources_scraped: list = field(default_factory=list)
    sources_failed: list = field(default_factory=list)
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_db_records(self) -> dict[str, list]:
        """
        Return dict of {table_name: [records]} ready to pass to base.upsert().
        destination_id must be filled in by the caller.
        """
        records = {
            "places": self.places,
            "hotels": self.hotels,
            "local_events": self.events,
        }
        if self.local_insights:
            records["blogs_and_guides"] = [{
                "title": f"Local Insights for {self.destination_name}",
                "url": "https://trip-planner-local-insights",
                "author": "AI Scout",
                "content": "Aggregated local insights and tips from various travel sources.",
                "key_tips": [],
                "local_insights": self.local_insights,
            }]
        return records


# ---------------------------------------------------------------------------
# SmartScraper
# ---------------------------------------------------------------------------

# Max 3 concurrent Playwright browser instances to prevent resource exhaustion
_browser_semaphore = asyncio.Semaphore(3)


class SmartScraper:
    """
    Orchestrates BrowserAgent across multiple sites in parallel.
    Merges and deduplicates results into a single ScrapedBundle.
    """

    def __init__(self, timeout_per_site: int = 30):
        self._default_timeout = timeout_per_site

    async def scrape_destination(
        self,
        destination: dict,
        data_types: Optional[list[str]] = None,
        max_sites: int = 5,
        timeout_per_site: int = 30,
    ) -> ScrapedBundle:
        """
        Scrape a destination from multiple sites in parallel.

        Args:
            destination: dict with keys name, slug, lat, lon, state
            data_types:  optional filter — only include sites that provide these
            max_sites:   cap on concurrent site scrapes
            timeout_per_site: seconds per site before giving up
        """
        start_time = time.time()
        bundle = ScrapedBundle(destination_name=destination.get("name", ""))
        dest_name = destination.get("name", "")

        bus.emit_sync(ScraperEvent(
            type="dest_start",
            destination=dest_name,
        ))

        # 1. Filter configs by requested data types, already sorted by reliability desc
        configs = get_configs_for_data_types(data_types)[:max_sites]

        if not configs:
            logger.warning("SmartScraper: No matching site configs found.")
            return bundle

        # Track selected configs for run log
        selected_configs = configs

        # 2. Parallel scrape with per-site timeout (semaphore-limited)
        tasks = [
            self._scrape_one_site_safe(cfg, destination, timeout_per_site)
            for cfg in configs
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 3. FIX 3A — Merge only quality-passing results
        for cfg, result in zip(configs, results):
            site_name = cfg["name"]
            if isinstance(result, Exception):
                logger.warning(f"SmartScraper: {site_name} raised exception: {result}")
                bundle.sources_failed.append(site_name)
                bus.emit_sync(ScraperEvent(
                    type="site_failed",
                    destination=dest_name,
                    site=site_name,
                    detail=str(result)[:100],
                ))
                continue

            if not result:
                bundle.sources_failed.append(site_name)
                bus.emit_sync(ScraperEvent(
                    type="site_failed",
                    destination=dest_name,
                    site=site_name,
                    detail="empty result",
                ))
                continue

            # FIX 3A: Only accept explicitly medium/high quality results.
            # quality is None when Groq failed (429/error) — treat as failed.
            # quality == "low" means data exists but is mostly nulls — also failed.
            quality = result.get("_quality")
            skipped = result.get("_skipped", False)

            if skipped or quality not in ("medium", "high"):
                if skipped:
                    reason = "thin_content"
                elif quality is None:
                    reason = "groq_failed (no _quality set)"
                else:
                    reason = f"quality={quality}"
                logger.warning(
                    f"SmartScraper: {site_name} marked as failed ({reason}) — "
                    "data not included in bundle."
                )
                bundle.sources_failed.append(site_name)
                bus.emit_sync(ScraperEvent(
                    type="site_failed",
                    destination=dest_name,
                    site=site_name,
                    detail=reason,
                ))
                continue

            bus.emit_sync(ScraperEvent(
                type="site_done",
                destination=dest_name,
                site=site_name,
                quality=quality or "",
            ))
            bundle.sources_scraped.append(site_name)
            bundle.places.extend(result.get("places") or [])
            bundle.hotels.extend(result.get("hotels") or [])
            bundle.local_insights.extend(result.get("local_insights") or [])
            bundle.events.extend(result.get("events") or [])

            # Merge best_months (union, sorted)
            new_months = result.get("best_months") or []
            if new_months:
                bundle.best_months = sorted(set(bundle.best_months) | set(new_months))

            # First non-null avg_daily_budget_inr wins
            if not bundle.avg_daily_budget_inr and result.get("avg_daily_budget_inr"):
                bundle.avg_daily_budget_inr = result["avg_daily_budget_inr"]

        # 4. Deduplicate
        bundle.places = self._dedup_by_name(bundle.places)
        bundle.hotels = self._dedup_by_name(bundle.hotels)
        bundle.local_insights = list(dict.fromkeys(bundle.local_insights))  # ordered dedup

        # 4b. Emit records_saved / records_rejected events
        valid_count = len(bundle.places) + len(bundle.hotels)
        rejected_count = len(bundle.sources_failed)
        bus.emit_sync(ScraperEvent(
            type="records_saved",
            destination=dest_name,
            count=valid_count,
            detail=f"{len(bundle.places)} places, {len(bundle.hotels)} hotels",
        ))
        if rejected_count > 0:
            bus.emit_sync(ScraperEvent(
                type="records_rejected",
                destination=dest_name,
                count=rejected_count,
                detail=f"failed sites: {bundle.sources_failed[:3]}",
            ))

        # 5. FIX 3D — Post-bundle geocoding for places missing lat/lon
        if bundle.places:
            bundle.places = await self._geocode_places(bundle.places, dest_name)

        # 6. FIX 3E — Update data_quality_score in destinations table
        dest_id = destination.get("id")
        if dest_id:
            await self._update_quality_score(dest_id, dest_name, bundle)

        # 7. Write scraper run log
        duration_seconds = round(time.time() - start_time, 1)
        try:
            from core.supabase_client import db
            import asyncio as _asyncio
            loop = _asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: db.table("scraper_run_logs").insert({
                    "destination_slug":   destination.get("slug", ""),
                    "destination_name":   dest_name,
                    "sources_attempted":  [c["name"] for c in selected_configs],
                    "sources_succeeded":  bundle.sources_scraped,
                    "sources_failed":     bundle.sources_failed,
                    "places_extracted":   len(bundle.places),
                    "hotels_extracted":   len(bundle.hotels),
                    "insights_extracted": len(bundle.local_insights),
                    "records_rejected":   rejected_count,
                    "bundle_passed":      len(bundle.sources_scraped) > 0,
                    "duration_seconds":   duration_seconds,
                }).execute()
            )
        except Exception as log_err:
            logger.warning(f"SmartScraper: Failed to write scraper log: {log_err}")

        # Emit dest_end
        bus.emit_sync(ScraperEvent(
            type="dest_end",
            destination=dest_name,
            count=valid_count,
        ))

        logger.info(
            f"SmartScraper: {dest_name} — "
            f"{len(bundle.places)} places, {len(bundle.hotels)} hotels, "
            f"sources_scraped={bundle.sources_scraped}, "
            f"sources_failed={bundle.sources_failed}"
        )
        return bundle

    async def _scrape_one_site_safe(
        self,
        config: dict,
        destination: dict,
        timeout_per_site: int,
    ) -> dict:
        """Rate-limited wrapper: acquires semaphore before launching browser."""
        async with _browser_semaphore:
            return await self._scrape_one_site(config, destination, timeout_per_site)

    async def _scrape_one_site(
        self,
        config: dict,
        destination: dict,
        timeout_per_site: int,
    ) -> dict:
        """
        Scrape a single site config for the given destination.
        Returns {} on any failure.
        """
        site_name = config["name"]
        dest_name = destination["name"]
        dest_slug = destination.get("slug", dest_name.lower().replace(" ", "-"))

        # Build URL — handle {destination-slug} placeholder
        try:
            url = config["search_url"].format(
                destination=dest_name,
                **{"destination-slug": dest_slug},
            )
        except KeyError:
            url = config["search_url"].format(destination=dest_name)

        logger.info(f"SmartScraper: Scraping {site_name} → {url}")

        bus.emit_sync(ScraperEvent(
            type="site_start",
            destination=dest_name,
            site=site_name,
        ))

        agent = BrowserAgent()
        try:
            if config.get("search_selector"):
                coro = agent.search_and_extract(
                    config["base_url"],
                    config["search_selector"],
                    dest_name,
                )
            else:
                coro = agent.extract_from_url(url, dest_name)

            result = await asyncio.wait_for(coro, timeout=timeout_per_site)
            result["_source"] = site_name
            return result

        except asyncio.TimeoutError:
            logger.warning(f"SmartScraper: {site_name} timed out after {timeout_per_site}s")
            return {}
        except Exception as e:
            logger.error(f"SmartScraper: {site_name} failed: {e}")
            return {}

    # ------------------------------------------------------------------
    # FIX 3D — Post-bundle geocoding
    # ------------------------------------------------------------------

    async def _geocode_places(self, places: list, dest_name: str) -> list:
        """
        For every place missing lat/lon, query Nominatim using
        "{place_name}, {dest_name}, India" as the search term.
        Rate-limited to 1 req/sec per Nominatim policy.
        """
        needs_geocoding = [p for p in places if not p.get("lat") or p.get("lat") == 0]
        if not needs_geocoding:
            return places

        logger.info(f"SmartScraper: Geocoding {len(needs_geocoding)} places for {dest_name}")

        for place in needs_geocoding:
            place_name = place.get("name", "")
            area = place.get("area", "")
            query_parts = [p for p in [place_name, area, dest_name, "India"] if p]
            query = ", ".join(query_parts)

            await asyncio.sleep(1)  # Nominatim 1 req/sec policy
            try:
                coords = await self._nominatim_search(query)
                if coords:
                    place["lat"] = coords[0]
                    place["lon"] = coords[1]
            except Exception as e:
                logger.debug(f"SmartScraper: Geocoding failed for '{place_name}': {e}")

        return places

    async def _nominatim_search(self, query: str) -> Optional[tuple]:
        """Return (lat, lon) tuple or None."""
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": query, "format": "json", "limit": 1}
        try:
            async with httpx.AsyncClient(timeout=8, headers=NOMINATIM_HEADERS) as client:
                r = await client.get(url, params=params)
                if r.status_code == 200:
                    data = r.json()
                    if data:
                        return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception as e:
            logger.debug(f"SmartScraper: Nominatim error: {e}")
        return None

    # ------------------------------------------------------------------
    # FIX 3E — Update data_quality_score in destinations table
    # ------------------------------------------------------------------

    async def _update_quality_score(
        self, dest_id: str, dest_name: str, bundle: "ScrapedBundle"
    ) -> None:
        """Write quality score and scraped_at back to the destinations table."""
        score = self._calculate_quality_score(bundle)
        payload = {
            "data_quality_score": score,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }
        if bundle.best_months:
            payload["best_months"] = bundle.best_months
        if bundle.avg_daily_budget_inr:
            payload["avg_daily_budget_inr"] = bundle.avg_daily_budget_inr

        try:
            from core.supabase_client import db
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: db.table("destinations").update(payload).eq("id", dest_id).execute()
            )

            logger.info(
                f"SmartScraper: Updated {dest_name} — score={score}, "
                f"scraped_at={payload['scraped_at']}"
            )
        except Exception as e:
            logger.warning(f"SmartScraper: Failed to update quality score for {dest_name}: {e}")

    def _calculate_quality_score(self, bundle: "ScrapedBundle") -> int:
        """Score 0–100 based on how much data was retrieved."""
        score = 0
        score += min(len(bundle.places) * 5, 40)          # max 40 pts
        score += min(len(bundle.hotels) * 4, 20)           # max 20 pts
        score += min(len(bundle.local_insights) * 3, 15)   # max 15 pts
        score += 10 if bundle.best_months else 0
        score += 10 if bundle.avg_daily_budget_inr else 0
        score += min(len(bundle.events) * 3, 15)           # max 15 pts
        return min(score, 100)

    # ------------------------------------------------------------------
    # Deduplication helpers
    # ------------------------------------------------------------------

    def _dedup_by_name(self, items: list[dict], cutoff: float = 0.85) -> list[dict]:
        """
        Fuzzy deduplicate a list of dicts by their 'name' field.
        Keeps the first occurrence when similarity >= cutoff.
        """
        unique: list[dict] = []
        names: list[str] = []

        for item in items:
            name = (item.get("name") or "").strip().lower()
            if not name:
                unique.append(item)
                continue

            is_dup = False
            for existing_name in names:
                ratio = SequenceMatcher(None, name, existing_name).ratio()
                if ratio >= cutoff:
                    is_dup = True
                    break

            if not is_dup:
                unique.append(item)
                names.append(name)

        return unique