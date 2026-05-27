# IMPLEMENTATION NOTE:
# LLM-guided browser agent using Playwright for human-like navigation.
# Uses Groq to extract structured data from raw page content.
# No hardcoded CSS selectors for data extraction — entirely LLM-driven.
# Extends patterns from base.py (UA rotation, graceful error handling).
#
# FIX 1A — Non-optional action failures no longer abort extraction.
#           Only page.goto() failure is considered unrecoverable.
# FIX 1B — Pages with < 500 cleaned chars skip Groq to avoid null records.
# FIX 1C — Post-extraction quality grading (high / medium / low).
# FIX 1D — Smart scroll: stops when page height stops growing.
# FIX 1E — Semantic content extraction (article/main/…) before body fallback.

import asyncio
import json
import logging
import random
import re
from typing import Dict, List

from core.llm_client import llm_client
from core.extraction_cache import extraction_cache

logger = logging.getLogger(__name__)

# User agents (same pool as base.py pattern)
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]

# Semantic content selectors tried in priority order (FIX 1E)
_CONTENT_SELECTORS = [
    "article",
    "main",
    "#content",
    ".content",
    "#main-content",
    ".article-body",
    ".post-content",
    '[role="main"]',
]

# Minimum cleaned-text length before calling Groq (FIX 1B)
_MIN_CONTENT_CHARS = 500


class BrowserAgent:
    """
    Playwright-based agent that navigates sites like a human and uses
    Groq to extract structured data from raw page content.
    No hardcoded CSS selectors — extraction is entirely LLM-driven.
    """

    EXTRACTION_PROMPT = """
You are a data extraction agent. You will receive raw text content
scraped from a travel website page about {destination}.

Extract ALL available information and return ONLY valid JSON with
these keys (use null if not found):
{{
  "places": [
    {{
      "name": "str — exact place name",
      "category": "str — be specific: fort/temple/lake/market/viewpoint/beach/museum/park",
      "area": "str — locality or neighbourhood within the destination",
      "description": "str — 2-3 sentences about the place, must not be empty",
      "why_visit": "str — one compelling sentence on why this place is unmissable",
      "entry_fee_inr": null,
      "duration_hours": null,
      "best_time": null,
      "tips": null
    }}
  ],
  "hotels": [
    {{
      "name": "str",
      "neighborhood": "str — area of the city where hotel is located",
      "property_type": "str — hotel/hostel/guesthouse/resort/homestay",
      "price_min_inr": 0,
      "price_max_inr": 0,
      "rating": null,
      "review_count": null,
      "amenities": []
    }}
  ],
  "local_insights": ["str — specific, actionable tip for travellers"],
  "best_months": [1],
  "avg_daily_budget_inr": {{"budget": 0, "mid": 0, "premium": 0}},
  "events": [
    {{"name": "str", "event_type": "str", "description": "str",
      "start_date": "str", "impact_on_travel": "str"}}
  ],
  "transport": [
    {{"operator": "str", "price_inr": 0, "duration_minutes": 0,
      "departure_times": ["HH:MM"], "frequency": "str", "booking_url": "str",
      "travel_class": "str - Economy/Sleeper/AC etc or null"}}
  ]
}}

CRITICAL RULES:
- Never return an empty string "" for description or why_visit — use null if unknown.
- Never return 0 for entry_fee_inr if the fee is unknown — use null.
- Only include places you have ACTUAL TEXT content for. Quality over quantity.
- 5 well-described places beats 20 with null descriptions.
- For transport pages: extract every visible fare/price. price_inr must be a plain integer.
- Return ONLY the JSON object, no preamble, no markdown fences, no explanation.

Page content:
{text}
"""

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------

    async def navigate_and_extract(
        self,
        url: str,
        destination: str,
        actions: List[Dict],
    ) -> Dict:
        import sys
        if sys.platform == "win32":
            loop = asyncio.get_running_loop()
            loop_class_name = type(loop).__name__
            if "Proactor" not in loop_class_name:
                logger.info(
                    f"BrowserAgent: Non-Proactor loop ({loop_class_name}) detected on Windows. "
                    "Offloading Playwright execution to a Proactor thread."
                )
                import threading

                result = {}
                exception = None

                def worker():
                    nonlocal result, exception
                    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        result = new_loop.run_until_complete(
                            self._navigate_and_extract_impl(url, destination, actions)
                        )
                    except Exception as e:
                        exception = e
                    finally:
                        try:
                            pending = asyncio.all_tasks(new_loop)
                            for task in pending:
                                task.cancel()
                            if pending:
                                new_loop.run_until_complete(
                                    asyncio.gather(*pending, return_exceptions=True)
                                )
                        except Exception as close_err:
                            logger.debug(
                                f"BrowserAgent: Error cleaning up background loop tasks: {close_err}"
                            )
                        new_loop.close()

                thread = threading.Thread(target=worker)

                def run_thread():
                    thread.start()
                    thread.join()
                    if exception:
                        raise exception
                    return result

                return await loop.run_in_executor(None, run_thread)

        return await self._navigate_and_extract_impl(url, destination, actions)

    async def extract_from_url(self, url: str, destination: str) -> Dict:
        """Simple version — just goto URL, smart-scroll, and extract. No custom actions."""
        return await self.navigate_and_extract(
            url,
            destination,
            [
                {"type": "goto", "url": url},
                {"type": "smart_scroll"},
                {"type": "wait_for_content", "min_chars": 500},
            ],
        )

    async def search_and_extract(
        self,
        base_url: str,
        search_selector: str,
        destination: str,
    ) -> Dict:
        """Navigate to site, find search box, type destination, extract results."""
        return await self.navigate_and_extract(
            base_url,
            destination,
            [
                {"type": "goto", "url": base_url},
                {"type": "wait", "selector": search_selector, "timeout": 5000, "optional": True},
                {"type": "click", "selector": search_selector, "optional": True},
                {"type": "type", "selector": search_selector, "text": destination, "optional": True},
                {"type": "press", "key": "Enter", "optional": True},
                {"type": "smart_scroll"},
                {"type": "wait_for_content", "min_chars": 1000},
            ],
        )

    # ------------------------------------------------------------------
    # Core implementation
    # ------------------------------------------------------------------

    async def _navigate_and_extract_impl(
        self,
        url: str,
        destination: str,
        actions: List[Dict],
    ) -> Dict:
        """
        Execute a sequence of browser actions then extract structured data
        from the resulting page using Groq LLM.

        actions format:
          {"type": "goto",              "url": "..."}
          {"type": "wait",              "selector": "body", "timeout": 3000, "optional": True/False}
          {"type": "smart_scroll"}          ← FIX 1D: stops when height stabilises
          {"type": "scroll",            "times": 3}   ← kept for backward compat
          {"type": "click",             "selector": "...", "optional": True}
          {"type": "type",              "selector": "...", "text": "..."}
          {"type": "press",             "key": "Enter"}
          {"type": "wait_for_content",  "min_chars": 1000}

        FIX 1A: Only page.goto() failure is unrecoverable.
                All other action failures are logged and skipped.
        """
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            logger.error("BrowserAgent: playwright not installed. Run: playwright install chromium")
            return {}

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent=random.choice(_USER_AGENTS),
                    viewport={"width": 1280, "height": 900},
                )
                page = await context.new_page()
                navigation_done = False  # track if goto succeeded

                for action in actions:
                    a_type = action.get("type")
                    optional = action.get("optional", False)

                    try:
                        # ── goto ─────────────────────────────────────────────────
                        if a_type == "goto":
                            await page.goto(
                                action["url"],
                                wait_until="domcontentloaded",
                                timeout=action.get("timeout", 30000),
                            )
                            navigation_done = True

                        # ── wait for selector ────────────────────────────────────
                        elif a_type == "wait":
                            await page.wait_for_selector(
                                action["selector"],
                                timeout=action.get("timeout", 5000),
                            )

                        # ── smart scroll (FIX 1D) ────────────────────────────────
                        elif a_type == "smart_scroll":
                            await self._smart_scroll(page, max_scrolls=action.get("max_scrolls", 5))

                        # ── legacy fixed scroll (backward compat) ────────────────
                        elif a_type == "scroll":
                            times = action.get("times", 2)
                            for _ in range(times):
                                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                                await asyncio.sleep(0.8)

                        # ── click ────────────────────────────────────────────────
                        elif a_type == "click":
                            await page.click(
                                action["selector"],
                                timeout=action.get("timeout", 5000),
                            )

                        # ── type ─────────────────────────────────────────────────
                        elif a_type == "type":
                            await page.fill(action["selector"], action.get("text", ""))

                        # ── press key ────────────────────────────────────────────
                        elif a_type == "press":
                            await page.keyboard.press(action["key"])
                            await asyncio.sleep(2)

                        # ── wait for minimum content ─────────────────────────────
                        elif a_type == "wait_for_content":
                            min_chars = action.get("min_chars", 500)
                            for _ in range(10):
                                try:
                                    text = await page.inner_text("body")
                                    if len(text) >= min_chars:
                                        break
                                except Exception:
                                    pass
                                await asyncio.sleep(0.5)

                    except Exception as e:
                        # ── FIX 1A: goto failure is the ONLY unrecoverable case ──
                        if a_type == "goto":
                            logger.warning(f"BrowserAgent: Page navigation failed — {e}")
                            await browser.close()
                            return {}

                        # All other failures: log and continue regardless of optional flag
                        if optional:
                            logger.debug(f"BrowserAgent: Optional action '{a_type}' skipped: {e}")
                        else:
                            logger.warning(
                                f"BrowserAgent: Required action '{a_type}' failed: {e} "
                                "(continuing extraction with whatever loaded)"
                            )
                        continue

                # ── FIX 1E: prefer semantic content area over full body ────────
                raw_text = await self._extract_main_content(page)
                await browser.close()

            # ── FIX 1B: thin-content gate ────────────────────────────────────
            clean_text = self._clean_page_text(raw_text)
            if len(clean_text) < _MIN_CONTENT_CHARS:
                logger.warning(
                    f"BrowserAgent: Skipping LLM — page too thin: {len(clean_text)} chars"
                )
                return {
                    "_skipped": True,
                    "_reason": "thin_content",
                    "_chars": len(clean_text),
                }

            raw_result = await self._call_llm(clean_text, destination)

            # ── FIX 1C: post-extraction quality check ────────────────────────
            return self._annotate_quality(raw_result)

        except Exception as e:
            logger.error(f"BrowserAgent: Unrecoverable navigation error: {e}")
            return {}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _smart_scroll(self, page, max_scrolls: int = 5) -> None:
        """
        FIX 1D — Scroll until page height stops growing (lazy content loaded)
        or max_scrolls is reached.
        """
        prev_height = 0
        for i in range(max_scrolls):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(1500)
            try:
                curr_height = await page.evaluate("document.body.scrollHeight")
            except Exception:
                break
            if curr_height == prev_height:
                logger.debug(f"BrowserAgent: Smart scroll stopped at iteration {i+1} (no new content)")
                break
            prev_height = curr_height

    async def _extract_main_content(self, page) -> str:
        """
        FIX 1E — Try semantic content elements first (article, main, #content, …).
        Falls back to full body text. This removes nav/footer/cookie banners
        without needing manual line-cleaning heuristics.
        """
        for sel in _CONTENT_SELECTORS:
            try:
                elem = page.locator(sel).first
                if await elem.count() > 0:
                    text = await elem.inner_text()
                    if len(text) > 300:
                        logger.debug(f"BrowserAgent: Using content selector '{sel}' ({len(text)} chars)")
                        return text
            except Exception:
                continue
        try:
            return await page.inner_text("body")
        except Exception:
            return ""

    def _clean_page_text(self, raw: str) -> str:
        """
        Remove nav/footer boilerplate, short lines, duplicates.
        Truncate to 8000 chars for Groq context safety.
        """
        seen: set = set()
        cleaned: List[str] = []

        for line in raw.splitlines():
            stripped = line.strip()

            # Skip short lines (nav links, button text)
            if len(stripped) < 20:
                continue

            # Skip lines that are purely numbers or symbols
            if re.match(r"^[\d\s\.\,\!\?\@\#\$\%\^\&\*\(\)\-\_\+\=\/\\|<>]+$", stripped):
                continue

            # Skip duplicates
            if stripped in seen:
                continue

            seen.add(stripped)
            cleaned.append(stripped)

        return "\n".join(cleaned)[:8000]

    def _annotate_quality(self, data: Dict) -> Dict:
        """
        FIX 1C — Inspect extracted data and attach a _quality key.

        Grades:
          high   — >5 items, <20% null fields
          medium — 2–5 items, or 20–50% null fields
          low    — <2 items, or >50% null fields

        Also logs warnings for suspicious patterns.
        """
        if not data:
            # Empty dict means Groq failed or returned nothing parseable.
            # Set _quality=None explicitly so FIX 3A gate rejects it.
            return {"_quality": None, "_reason": "empty_result", "_items_extracted": 0}

        if data.get("_skipped"):
            # Already marked as thin_content — pass through untouched.
            return data

        places = data.get("places") or []
        hotels = data.get("hotels") or []
        all_items = places + hotels

        total_items = len(all_items)

        # Compute null-field ratio across all items
        null_count = 0
        total_fields = 0
        for item in all_items:
            for v in item.values():
                total_fields += 1
                if v is None or v == "" or v == []:
                    null_count += 1

        null_ratio = (null_count / total_fields) if total_fields > 0 else 1.0

        # ── Warning: most descriptions are null ────────────────────────────
        if places:
            no_desc = sum(1 for p in places if not p.get("description"))
            if no_desc / len(places) > 0.5:
                logger.warning(
                    f"BrowserAgent: {no_desc}/{len(places)} places have null description — "
                    "page may have been content-light."
                )

            # ── Warning: no why_visit filled (new schema check) ─────────────
            no_why = sum(1 for p in places if not p.get("why_visit"))
            if no_why == len(places) and len(places) > 0:
                logger.warning(
                    "BrowserAgent: All places have null why_visit — "
                    "extraction may be skeleton-level."
                )

        # ── Grade ─────────────────────────────────────────────────────────
        if total_items > 5 and null_ratio < 0.20:
            quality = "high"
        elif 2 <= total_items <= 5 or 0.20 <= null_ratio <= 0.50:
            quality = "medium"
        else:
            quality = "low"

        data["_quality"] = quality
        data["_items_extracted"] = total_items
        data["_null_ratio"] = round(null_ratio, 2)

        logger.info(
            f"BrowserAgent: quality={quality}, items={total_items}, null_ratio={null_ratio:.0%}"
        )
        return data


    async def _call_llm(self, text: str, destination: str) -> Dict:
        """
        Send cleaned page text to LLM (LM Studio primary, Groq fallback).
        Checks extraction cache first to avoid redundant LLM calls.
        Returns parsed dict or {} on failure.
        """
        if not text.strip():
            logger.warning("BrowserAgent: Empty text after cleaning, skipping LLM call.")
            return {}

        # Check extraction cache first
        cached = extraction_cache.get(text)
        if cached:
            logger.info(f"Cache hit for {destination} — skipping LLM call")
            cached["_from_cache"] = True
            return cached

        system = "You are a travel data extraction agent. Return only valid JSON."
        prompt = self.EXTRACTION_PROMPT.format(destination=destination, text=text)

        result = await llm_client.extract_json(
            prompt=prompt,
            system=system,
            max_tokens=4000,
        )

        if result:
            extraction_cache.set(text, result)

        return result