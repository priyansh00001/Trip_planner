# IMPLEMENTATION NOTE: In-memory event queue that captures every
# scraper action in real time. SSE endpoint reads from this queue.
# Events expire after 1 hour to prevent memory growth.
# This is the backbone of the live dashboard feed.

import asyncio
import json
import logging
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Literal, List, Dict

EventType = Literal[
    "cycle_start", "cycle_end",
    "dest_start",  "dest_end",   "dest_failed",
    "site_start",  "site_done",  "site_failed",
    "records_saved", "records_rejected",
    "transport_start", "transport_done", "transport_failed",
    "llm_call",    "llm_success", "llm_failed", "llm_rate_limit",
    "db_write",    "db_error",
    "validator_pass", "validator_fail",
    "cache_hit",
]


@dataclass
class ScraperEvent:
    type:        str  # EventType (as str for dataclass compat)
    destination: str = ""
    site:        str = ""
    mode:        str = ""        # transport mode
    count:       int = 0         # records affected
    detail:      str = ""        # human readable message
    quality:     str = ""        # high/medium/low
    tokens_used: int = 0         # groq tokens if llm_call
    ts:          str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_sse(self) -> str:
        return f"data: {json.dumps(asdict(self))}\n\n"

    def to_log_line(self) -> str:
        icon = {
            "cycle_start":      "🔄",
            "cycle_end":        "✅",
            "dest_start":       "📍",
            "dest_end":         "✅",
            "dest_failed":      "❌",
            "site_start":       "🌐",
            "site_done":        "📄",
            "site_failed":      "⚠️",
            "records_saved":    "💾",
            "records_rejected": "🚫",
            "transport_start":  "🚆",
            "transport_done":   "✅",
            "transport_failed": "❌",
            "llm_call":         "🤖",
            "llm_success":      "✅",
            "llm_failed":       "❌",
            "llm_rate_limit":   "⛔",
            "db_write":         "💽",
            "db_error":         "🔥",
            "validator_pass":   "✓",
            "validator_fail":   "✗",
            "cache_hit":        "⚡",
        }.get(self.type, "•")
        time = self.ts[11:19]  # HH:MM:SS
        parts = [time, icon, self.type]
        if self.destination:
            parts.append(self.destination)
        if self.site:
            parts.append(f"[{self.site}]")
        if self.count:
            parts.append(f"×{self.count}")
        if self.detail:
            parts.append(f"— {self.detail}")
        return " ".join(parts)


class EventBus:

    def __init__(self, max_events: int = 500):
        self._queue:     deque = deque(maxlen=max_events)
        self._listeners: List[asyncio.Queue] = []
        self._stats:     Dict = self._empty_stats()
        self._lock = asyncio.Lock()

    def _empty_stats(self) -> dict:
        return {
            "total_records_saved":    0,
            "total_records_rejected": 0,
            "total_llm_calls":        0,
            "total_cache_hits":       0,
            "total_groq_tokens":      0,
            "destinations_scraped":   set(),
            "destinations_failed":    set(),
            "sites_failed":           {},
            "cycle_count":            0,
            "last_cycle_start":       None,
            "last_cycle_end":         None,
        }

    async def emit(self, event: ScraperEvent):
        """Emit event to queue and all active SSE listeners."""
        async with self._lock:
            self._queue.append(event)
            self._update_stats(event)
            logging.getLogger("event_bus").info(event.to_log_line())
            # Push to all SSE listeners
            dead = []
            for q in self._listeners:
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    dead.append(q)
            for q in dead:
                self._listeners.remove(q)

    def emit_sync(self, event: ScraperEvent):
        """
        Synchronous emit for use in non-async scraper contexts.
        Uses fire-and-forget task creation. Never raises.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(self.emit(event))
            else:
                loop.run_until_complete(self.emit(event))
        except Exception:
            pass  # never let event emission crash a scraper

    def subscribe(self) -> asyncio.Queue:
        """Returns a queue that receives all future events."""
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._listeners.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self._listeners:
            self._listeners.remove(q)

    def recent_events(self, limit: int = 100) -> list:
        events = list(self._queue)
        return events[-limit:]

    def get_stats(self) -> dict:
        s = dict(self._stats)
        s["destinations_scraped"] = list(s["destinations_scraped"])
        s["destinations_failed"]  = list(s["destinations_failed"])
        return s

    def _update_stats(self, e: ScraperEvent):
        s = self._stats
        if e.type == "records_saved":
            s["total_records_saved"]    += e.count
            if e.destination:
                s["destinations_scraped"].add(e.destination)
        if e.type == "records_rejected":
            s["total_records_rejected"] += e.count
        if e.type == "dest_failed":
            if e.destination:
                s["destinations_failed"].add(e.destination)
        if e.type == "llm_call":
            s["total_llm_calls"]        += 1
            s["total_groq_tokens"]      += e.tokens_used
        if e.type == "cache_hit":
            s["total_cache_hits"]       += 1
        if e.type == "cycle_start":
            s["cycle_count"]            += 1
            s["last_cycle_start"]       = e.ts
        if e.type == "cycle_end":
            s["last_cycle_end"]         = e.ts
        if e.type == "site_failed":
            s["sites_failed"][e.site]   = s["sites_failed"].get(e.site, 0) + 1


# Module-level singleton
bus = EventBus()
