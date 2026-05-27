# IMPLEMENTATION NOTE: Caches LLM extraction results keyed by MD5 hash
# of page content. If page unchanged since last scrape, returns cached
# result without any LLM call.
# Simple in-memory dict persisted to file for MVP.

import hashlib
import json
import os
import pickle
from datetime import datetime, timedelta

CACHE_PATH = "data/extraction_cache.pkl"
CACHE_TTL_HOURS = 72  # reuse extraction for 3 days if content unchanged


class ExtractionCache:

    def __init__(self):
        self._cache: dict[str, dict] = {}  # hash → {result, cached_at}
        self._load()

    def get(self, content: str) -> dict | None:
        h = self._hash(content)
        entry = self._cache.get(h)
        if not entry:
            return None
        age = datetime.utcnow() - entry["cached_at"]
        if age > timedelta(hours=CACHE_TTL_HOURS):
            del self._cache[h]
            return None
        # Emit cache_hit event
        try:
            from core.event_bus import bus, ScraperEvent
            bus.emit_sync(ScraperEvent(
                type="cache_hit",
                detail="Saved LLM call — cache hit",
            ))
        except Exception:
            pass
        return entry["result"]

    def set(self, content: str, result: dict):
        h = self._hash(content)
        self._cache[h] = {"result": result, "cached_at": datetime.utcnow()}
        self._save()

    def _hash(self, content: str) -> str:
        return hashlib.md5(content.encode()).hexdigest()

    def _save(self):
        os.makedirs("data", exist_ok=True)
        with open(CACHE_PATH, "wb") as f:
            pickle.dump(self._cache, f)

    def _load(self):
        if os.path.exists(CACHE_PATH):
            try:
                with open(CACHE_PATH, "rb") as f:
                    self._cache = pickle.load(f)
            except Exception:
                self._cache = {}

    def stats(self) -> dict:
        return {
            "cached_entries": len(self._cache),
            "cache_path":     CACHE_PATH,
            "ttl_hours":      CACHE_TTL_HOURS,
        }


extraction_cache = ExtractionCache()
