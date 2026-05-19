# IMPLEMENTATION NOTE:
# Smart scraper orchestrator — coordinates BrowserAgent across multiple
# sites in parallel for a given destination.
# Uses asyncio.gather(return_exceptions=True) for fault-tolerant parallel scraping.
# Deduplicates places/hotels using difflib fuzzy matching (cutoff 0.85).

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Optional

from scrapers.browser_agent import BrowserAgent
from scrapers.site_configs import get_configs_for_data_types

logger = logging.getLogger(__name__)


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

    def __init__(self, timeout_per_site: int = 20):
        self._default_timeout = timeout_per_site

    async def scrape_destination(
        self,
        destination: dict,
        data_types: Optional[list[str]] = None,
        max_sites: int = 5,
        timeout_per_site: int = 20,
    ) -> ScrapedBundle:
        """
        Scrape a destination from multiple sites in parallel.

        Args:
            destination: dict with keys name, slug, lat, lon, state
            data_types:  optional filter — only include sites that provide these
            max_sites:   cap on concurrent site scrapes
            timeout_per_site: seconds per site before giving up
        """
        bundle = ScrapedBundle(destination_name=destination.get("name", ""))

        # 1. Filter configs by requested data types, already sorted by reliability desc
        configs = get_configs_for_data_types(data_types)[:max_sites]

        if not configs:
            logger.warning("SmartScraper: No matching site configs found.")
            return bundle

        # 2. Parallel scrape with per-site timeout (semaphore-limited)
        tasks = [
            self._scrape_one_site_safe(cfg, destination, timeout_per_site)
            for cfg in configs
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 3. Merge results
        for cfg, result in zip(configs, results):
            site_name = cfg["name"]
            if isinstance(result, Exception):
                logger.warning(f"SmartScraper: {site_name} raised exception: {result}")
                bundle.sources_failed.append(site_name)
                continue
            if not result:
                bundle.sources_failed.append(site_name)
                continue

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