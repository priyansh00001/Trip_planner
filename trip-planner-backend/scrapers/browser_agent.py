# IMPLEMENTATION NOTE:
# LLM-guided browser agent using Playwright for human-like navigation.
# Uses Groq to extract structured data from raw page content.
# No hardcoded CSS selectors for data extraction — entirely LLM-driven.
# Extends patterns from base.py (UA rotation, graceful error handling).

import asyncio
import json
import logging
import random
import re
from typing import Dict, List

from core.config import settings
from langchain_groq import ChatGroq

logger = logging.getLogger(__name__)

# temperature=0 for consistent structured output
llm = ChatGroq(
    api_key=settings.GROQ_API_KEY,
    model="llama-3.3-70b-versatile",
    temperature=0,
    max_tokens=1500,
)

# User agents (same pool as base.py pattern)
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]


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
    {{"name": "str", "category": "str", "description": "str",
      "entry_fee_inr": 0, "duration_hours": 0.0,
      "best_time": "str", "tips": "str", "lat": 0.0, "lon": 0.0}}
  ],
  "hotels": [
    {{"name": "str", "locality": "str", "property_type": "str",
      "price_min_inr": 0, "price_max_inr": 0,
      "rating": 0.0, "review_count": 0, "amenities": []}}
  ],
  "local_insights": ["str"],
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
Only include items where you have reasonable confidence in the data.
Do not hallucinate. If a field is missing, use null.
For transport pages: extract every visible fare/price option.
Each unique operator+price combination is a separate item.
price_inr must be a plain integer (no currency symbols).
If page shows price ranges, use the lower bound.
Return ONLY the JSON object, no preamble, no explanation.

Page content:
{text}
"""

    async def navigate_and_extract(
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
          {"type": "wait",              "selector": "body", "timeout": 3000}
          {"type": "scroll",            "times": 3}
          {"type": "click",             "selector": "...", "optional": True}
          {"type": "type",              "selector": "...", "text": "..."}
          {"type": "press",             "key": "Enter"}
          {"type": "wait_for_content",  "min_chars": 1000}

        On optional=True failure: skip and continue.
        On optional=False failure: log and return {}.
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

                for action in actions:
                    a_type = action.get("type")
                    optional = action.get("optional", False)

                    try:
                        if a_type == "goto":
                            await page.goto(
                                action["url"],
                                wait_until="domcontentloaded",
                                timeout=action.get("timeout", 30000),
                            )

                        elif a_type == "wait":
                            await page.wait_for_selector(
                                action["selector"],
                                timeout=action.get("timeout", 5000),
                            )

                        elif a_type == "scroll":
                            times = action.get("times", 2)
                            for _ in range(times):
                                await page.evaluate("window.scrollBy(0, window.innerHeight)")
                                await asyncio.sleep(0.8)

                        elif a_type == "click":
                            await page.click(
                                action["selector"],
                                timeout=action.get("timeout", 5000),
                            )

                        elif a_type == "type":
                            await page.fill(action["selector"], action.get("text", ""))

                        elif a_type == "press":
                            await page.keyboard.press(action["key"])
                            await asyncio.sleep(2)

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
                        if optional:
                            logger.debug(f"BrowserAgent: Optional action '{a_type}' skipped: {e}")
                            continue
                        else:
                            logger.warning(f"BrowserAgent: Required action '{a_type}' failed: {e}")
                            await browser.close()
                            return {}

                # Prefer semantic content areas over full body
                raw_text = await self._extract_main_content(page)
                await browser.close()

            clean_text = self._clean_page_text(raw_text)
            return await self._call_groq(clean_text, destination)

        except Exception as e:
            logger.error(f"BrowserAgent: Unrecoverable navigation error: {e}")
            return {}

    async def extract_from_url(self, url: str, destination: str) -> Dict:
        """Simple version — just goto URL and extract. No custom actions."""
        return await self.navigate_and_extract(
            url,
            destination,
            [
                {"type": "goto", "url": url},
                {"type": "scroll", "times": 3},
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
                {"type": "wait", "selector": search_selector, "timeout": 5000},
                {"type": "click", "selector": search_selector, "optional": False},
                {"type": "type", "selector": search_selector, "text": destination},
                {"type": "press", "key": "Enter"},
                {"type": "scroll", "times": 4},
                {"type": "wait_for_content", "min_chars": 1000},
            ],
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _extract_main_content(self, page) -> str:
        """
        Try semantic content elements first (main, article, #content).
        Falls back to full body text.
        """
        for sel in ["main", "article", "#content", ".content", "#main-content"]:
            try:
                elem = page.locator(sel).first
                if await elem.count() > 0:
                    text = await elem.inner_text()
                    if len(text) > 300:
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

    async def _call_groq(self, text: str, destination: str) -> Dict:
        """
        Send cleaned page text to Groq.
        Returns parsed dict or {} on failure.
        """
        if not text.strip():
            logger.warning("BrowserAgent: Empty text after cleaning, skipping Groq call.")
            return {}

        prompt = self.EXTRACTION_PROMPT.format(destination=destination, text=text)

        try:
            response = await llm.ainvoke(prompt)
            content = response.content.strip()

            # Attempt 1: direct JSON parse
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                pass

            # Attempt 2: JSON inside ```json ... ``` fences
            match = re.search(r"```(?:json)?\s*([\s\S]+?)```", content)
            if match:
                try:
                    return json.loads(match.group(1).strip())
                except json.JSONDecodeError:
                    pass

            # Attempt 3: first { ... } block
            match = re.search(r"\{[\s\S]+\}", content)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass

            logger.warning(f"BrowserAgent: Could not parse Groq JSON. Preview: {content[:300]}")
            return {}

        except Exception as e:
            logger.error(f"BrowserAgent: Groq call failed: {e}")
            return {}