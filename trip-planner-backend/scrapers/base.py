# IMPLEMENTATION NOTE:
# This is the abstract base class for all data scrapers in the trip planner.
# Each scraper inherits from this class and implements the scrape() method.
# The base class provides:
# - Retry logic with exponential backoff
# - User agent rotation
# - Rate limiting between requests
# - Upsert helper for Supabase
# - Graceful error handling (never raises, always returns gracefully)

import asyncio
import random
import logging
from abc import ABC, abstractmethod
from typing import List, Dict
import httpx

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """Abstract base class for all scrapers."""

    # Override in subclass
    source_name: str = "base"
    scrape_interval_hours: int = 24

    # Configuration
    max_retries: int = 3
    retry_delay_seconds: int = 2
    rate_limit_seconds: float = 2.0

    # User agents for rotation
    user_agents: List[str] = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ]

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        """Lazy initialization of httpx client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True,
                headers={"User-Agent": self._get_random_ua()}
            )
        return self._client

    def _get_random_ua(self) -> str:
        """Get a random user agent."""
        return random.choice(self.user_agents)

    def _rotate_ua(self):
        """Rotate user agent for next request."""
        self.client.headers["User-Agent"] = self._get_random_ua()

    async def _rate_limit(self):
        """Apply rate limiting between requests."""
        await asyncio.sleep(self.rate_limit_seconds)

    @abstractmethod
    async def scrape(self, destination: Dict) -> List[Dict]:
        """
        Scrape data for a destination.

        Args:
            destination: Dict with keys: id, slug, name, lat, lon, state

        Returns:
            List of records to upsert into database
        """
        ...

    async def run(self, destination: Dict) -> Dict:
        """
        Execute the scraper with full error handling.

        This is the main entry point that handles:
        - Retries with exponential backoff
        - Logging start/end/count/errors
        - Never raises - always returns gracefully

        Args:
            destination: Dict with destination info

        Returns:
            Dict with status, count, records, and any errors
        """
        result = {
            "source": self.source_name,
            "destination": destination.get("name", "unknown"),
            "destination_slug": destination.get("slug", "unknown"),
            "status": "started",
            "count": 0,
            "records": [],
            "errors": [],
            "started_at": None,
            "finished_at": None,
        }

        try:
            result["started_at"] = asyncio.get_event_loop().time()

            for attempt in range(self.max_retries):
                try:
                    records = await self.scrape(destination)
                    result["count"] = len(records)
                    result["records"] = records
                    result["status"] = "ok"
                    break
                except Exception as e:
                    if attempt < self.max_retries - 1:
                        delay = self.retry_delay_seconds * (2 ** attempt)
                        logger.warning(
                            f"{self.source_name} attempt {attempt + 1} failed for "
                            f"{destination.get('name')}: {e}. Retrying in {delay}s..."
                        )
                        await asyncio.sleep(delay)
                    else:
                        result["status"] = "error"
                        result["errors"].append(str(e))
                        logger.error(
                            f"{self.source_name} scraper failed for "
                            f"{destination.get('name')} after {self.max_retries} attempts: {e}"
                        )

        except Exception as e:
            result["status"] = "error"
            result["errors"].append(str(e))
            logger.error(f"{self.source_name} scraper encountered unexpected error: {e}")

        result["finished_at"] = asyncio.get_event_loop().time()

        return result

    async def upsert(
        self,
        table: str,
        records: List[Dict],
        conflict_cols: List[str]
    ) -> Dict:
        """
        Upsert records into Supabase table.

        Args:
            table: Table name (e.g., 'places', 'hotels')
            records: List of record dicts
            conflict_cols: Columns to use for conflict resolution

        Returns:
            Dict with insert/update counts
        """
        from core.supabase_client import db

        if not records:
            return {"inserted": 0, "updated": 0, "total": 0}

        try:
            from datetime import datetime, timezone
            # Add scraped_at timestamp to each record
            for record in records:
                record["scraped_at"] = datetime.now(timezone.utc).isoformat()

            response = db.table(table).upsert(
                records,
                on_conflict=",".join(conflict_cols),
                returning="representation"
            ).execute()

            return {
                "inserted": len(records),
                "updated": 0,  # Upsert doesn't distinguish easily
                "total": len(records)
            }

        except Exception as e:
            logger.error(f"Upsert to {table} failed: {e}")
            return {"inserted": 0, "updated": 0, "total": 0, "error": str(e)}

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None