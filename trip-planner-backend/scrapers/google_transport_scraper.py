import httpx, asyncio, re, logging
from datetime import date, timedelta
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from core.llm_client import llm_client

logger = logging.getLogger(__name__)

class GoogleTransportScraper:

  UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
  )

  SEARCH_BASE = "https://www.google.com/search"

  # Delay between Google requests — be polite
  REQUEST_DELAY = 4  # seconds

  async def scrape_flights(
    self, origin: str, destination: str
  ) -> list[dict]:
    travel_date = (date.today() + timedelta(days=30)).strftime("%Y-%m-%d")
    query = (
      f"flights from {origin} to {destination} "
      f"{travel_date} price INR"
    )
    return await self._search_and_extract(
      query, origin, destination, "flight"
    )

  async def scrape_trains(
    self, origin: str, destination: str
  ) -> list[dict]:
    query = (
      f"{origin} to {destination} train ticket price "
      f"duration schedule INR"
    )
    return await self._search_and_extract(
      query, origin, destination, "train"
    )

  async def scrape_buses(
    self, origin: str, destination: str
  ) -> list[dict]:
    query = (
      f"{origin} to {destination} bus ticket price "
      f"duration INR redbus"
    )
    return await self._search_and_extract(
      query, origin, destination, "bus"
    )

  async def _search_and_extract(
    self,
    query: str,
    origin: str,
    destination: str,
    mode: str
  ) -> list[dict]:
    await asyncio.sleep(self.REQUEST_DELAY)
    text = await self._fetch_google_text(query)
    if not text or len(text) < 200:
      logger.warning(
        f"Google search thin content for {mode} "
        f"{origin}→{destination}: {len(text or '')} chars"
      )
      return []

    results = await self._extract_with_llm(
      text, origin, destination, mode
    )
    valid   = self._validate_results(results, mode)
    logger.info(
      f"Google {mode} {origin}→{destination}: "
      f"{len(valid)} valid results from {len(results)} extracted"
    )
    return valid

  async def _fetch_google_text(self, query: str) -> str | None:
    """
    Two-stage fetch:
    Stage 1 — try plain httpx GET (faster, no JS needed for snippets)
    Stage 2 — fall back to Playwright if httpx blocked
    """
    # Stage 1: httpx
    try:
      async with httpx.AsyncClient(
        timeout=15,
        headers={
          "User-Agent": self.UA,
          "Accept-Language": "en-IN,en;q=0.9",
          "Accept": "text/html,application/xhtml+xml",
        },
        follow_redirects=True
      ) as client:
        r = await client.get(
          self.SEARCH_BASE,
          params={"q": query, "hl": "en", "gl": "in", "num": "10"}
        )
        if r.status_code == 200:
          text = self._extract_text_from_html(r.text)
          if len(text) > 500:
            return text
          logger.debug("httpx got thin content, trying Playwright")
    except Exception as e:
      logger.debug(f"httpx failed: {e}, trying Playwright")

    # Stage 2: Playwright with stealth settings
    return await self._playwright_fetch(query)

  async def _playwright_fetch(self, query: str) -> str | None:
    try:
      async with async_playwright() as p:
        browser = await p.chromium.launch(
          headless=True,
          args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
          ]
        )
        context = await browser.new_context(
          user_agent=self.UA,
          viewport={"width": 1366, "height": 768},
          locale="en-IN",
          timezone_id="Asia/Kolkata",
          extra_http_headers={
            "Accept-Language": "en-IN,en;q=0.9",
          }
        )
        # Remove webdriver flag
        await context.add_init_script(
          "Object.defineProperty(navigator, 'webdriver', "
          "{get: () => undefined})"
        )
        page = await context.new_page()
        url  = (
          f"{self.SEARCH_BASE}?q={query.replace(' ', '+')}"
          f"&hl=en&gl=in&num=10"
        )
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(2000)

        # Check for CAPTCHA
        content = await page.content()
        if "captcha" in content.lower() or "unusual traffic" in content.lower():
          logger.warning("Google CAPTCHA detected — backing off 60s")
          await browser.close()
          await asyncio.sleep(60)
          return None

        text = self._extract_text_from_html(content)
        await browser.close()
        return text if len(text) > 200 else None
    except Exception as e:
      logger.error(f"Playwright Google fetch failed: {e}")
      return None

  def _extract_text_from_html(self, html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    # Remove script, style, nav tags
    for tag in soup(["script", "style", "nav", "footer", "header"]):
      tag.decompose()
    # Focus on main content areas
    for selector in ["#main", "#center_col", "#search", "body"]:
      el = soup.select_one(selector)
      if el:
        text = el.get_text(separator=" ", strip=True)
        if len(text) > 200:
          return text[:6000]  # cap at 6000 chars for LLM
    return soup.get_text(separator=" ", strip=True)[:6000]

  async def _extract_with_llm(
    self,
    text: str,
    origin: str,
    destination: str,
    mode: str
  ) -> list[dict]:
    mode_hint = {
      "flight": "airlines, flight duration, fare prices in INR",
      "train":  "train names, classes (Sleeper/3AC/2AC), prices in INR, duration",
      "bus":    "bus operators, bus type (Sleeper/Seater/AC), prices in INR, duration",
    }[mode]

    prompt = f"""
Extract {mode} transport options from {origin} to {destination}.
Look for: {mode_hint}

Page content:
{text}

Return JSON array. Each item:
{{
  "operator": "string — airline/train name/bus company",
  "price_inr": integer — one-way price per person,
  "duration_minutes": integer or null,
  "departure_times": ["HH:MM"] or [],
  "travel_class": "string or null",
  "frequency": "string e.g. 3 daily"
}}

Rules:
- price_inr must be a realistic INR integer (flight 1000-50000,
  train 200-5000, bus 200-3000)
- If price not found, omit the item entirely
- Return empty array [] if no {mode} data found
- Return ONLY the JSON array, no explanation
"""
    result = await llm_client.extract_json(
      prompt=prompt,
      system=(
        "You extract transport pricing data from search results. "
        "Return only valid JSON arrays. Never invent prices."
      ),
      max_tokens=1000
    )

    # Handle both list and dict responses
    if isinstance(result, list):
      return result
    if isinstance(result, dict):
      for key in ["transport", "results", "options", "data"]:
        if isinstance(result.get(key), list):
          return result[key]
    return []

  def _validate_results(
    self, results: list[dict], mode: str
  ) -> list[dict]:
    PRICE_RANGES = {
      "flight": (800,   50000),
      "train":  (150,   6000),
      "bus":    (150,   4000),
    }
    lo, hi = PRICE_RANGES[mode]
    valid  = []
    for item in results:
      price = item.get("price_inr", 0)
      if not isinstance(price, (int, float)) or price <= 0:
        continue
      if not (lo <= price <= hi):
        logger.debug(
          f"Rejected {mode} price ₹{price} "
          f"(range ₹{lo}–₹{hi})"
        )
        continue
      if not item.get("operator", "").strip():
        continue
      valid.append(item)
    return valid
