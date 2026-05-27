# IMPLEMENTATION NOTE: Single LLM interface with provider fallback chain.
# Scraping extraction uses LM Studio (local, unlimited).
# Itinerary building uses Groq (stronger model, rate managed).
# Token tracking prevents Groq exhaustion.

import httpx
import json
import logging
import re
from datetime import datetime, timezone

from core.config import settings
from core.event_bus import bus, ScraperEvent

logger = logging.getLogger(__name__)


class TokenBudget:
    """Tracks Groq token usage and enforces daily limit."""

    def __init__(self, daily_limit: int, reset_hour: int):
        self.daily_limit = daily_limit
        self.reset_hour = reset_hour
        self.tokens_used = 0
        self.last_reset = datetime.now(timezone.utc)

    def record_usage(self, tokens: int):
        self._maybe_reset()
        self.tokens_used += tokens
        logger.debug(f"Groq tokens used today: {self.tokens_used}/{self.daily_limit}")

    def can_use(self, estimated_tokens: int = 1500) -> bool:
        self._maybe_reset()
        return (self.tokens_used + estimated_tokens) < self.daily_limit

    def tokens_remaining(self) -> int:
        self._maybe_reset()
        return max(0, self.daily_limit - self.tokens_used)

    def _maybe_reset(self):
        now = datetime.now(timezone.utc)
        if (now - self.last_reset).total_seconds() > 86400:
            logger.info("Groq token budget reset (24h elapsed)")
            self.tokens_used = 0
            self.last_reset = now

    def status(self) -> dict:
        return {
            "tokens_used":      self.tokens_used,
            "daily_limit":      self.daily_limit,
            "tokens_remaining": self.tokens_remaining(),
            "can_use":          self.can_use(),
        }


class LMStudioClient:
    """
    Calls LM Studio local server (OpenAI-compatible API).
    Used for all scraping extraction — unlimited, no cost.
    """

    def __init__(self):
        self.base_url = settings.LM_STUDIO_URL
        self.model = settings.LM_STUDIO_MODEL
        self._available: bool | None = None  # None = not yet checked

    async def check_available(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get(f"{self.base_url}/models")
                self._available = r.status_code == 200
        except Exception:
            self._available = False
        return self._available

    async def extract(self, prompt: str, system: str,
                      max_tokens: int = 1500,
                      prefill: str | None = None) -> str | None:
        """
        Call Qwen via LM Studio. Returns raw text or None on failure.
        Does not raise — caller handles None as fallback signal.
        Retries once on empty response (cold-start behavior).
        """
        if self._available is False:
            return None
        if self._available is None:
            await self.check_available()
            if not self._available:
                return None

        import asyncio
        for attempt in range(2):  # retry once on empty response
            try:
                messages = [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": prompt}
                ]
                if prefill:
                    messages.append({"role": "assistant", "content": prefill})

                bus.emit_sync(ScraperEvent(type="llm_call", site="lmstudio"))
                async with httpx.AsyncClient(timeout=120) as client:
                    r = await client.post(
                        f"{self.base_url}/chat/completions",
                        json={
                            "model":       self.model,
                            "messages":    messages,
                            "max_tokens":  max_tokens,
                            "temperature": 0,
                        }
                    )
                    r.raise_for_status()
                    data = r.json()
                    content = data["choices"][0]["message"]["content"]
                    
                    if prefill:
                        content = prefill + content

                    # Treat empty/whitespace responses as failure
                    if not content or not content.strip():
                        if attempt == 0:
                            logger.info("LM Studio empty response — retrying after 2s (cold start)")
                            await asyncio.sleep(2)
                            continue
                        logger.warning("LM Studio returned empty response after retry")
                        return None
                    logger.debug(f"LM Studio response: {len(content)} chars")
                    bus.emit_sync(ScraperEvent(type="llm_success", site="lmstudio"))
                    return content
            except Exception as e:
                logger.warning(f"LM Studio call failed: {e}")
                self._available = False  # mark down, retry next cycle
                return None
        return None


class GroqLLMClient:
    """
    Calls Groq API with token budget enforcement.
    Used as fallback for extraction and primary for itinerary building.
    """

    def __init__(self, budget: TokenBudget):
        self.budget = budget
        from langchain_groq import ChatGroq
        self._llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model="llama-3.3-70b-versatile",
        )

    async def extract(self, prompt: str, system: str,
                      max_tokens: int = 1500,
                      estimated_cost: int = 1500) -> str | None:
        """
        Call Groq only if budget allows. Returns None if budget exhausted.
        """
        if not self.budget.can_use(estimated_cost):
            logger.warning(
                f"Groq budget exhausted "
                f"({self.budget.tokens_used}/{self.budget.daily_limit}). "
                f"Skipping call."
            )
            bus.emit_sync(ScraperEvent(
                type="llm_rate_limit",
                site="groq",
                detail="Daily token budget exhausted",
            ))
            return None

        try:
            bus.emit_sync(ScraperEvent(
                type="llm_call",
                site="groq",
                tokens_used=estimated_cost,
            ))
            from langchain_core.messages import HumanMessage, SystemMessage
            response = await self._llm.ainvoke([
                SystemMessage(content=system),
                HumanMessage(content=prompt),
            ])
            # Estimate token usage from response length
            # (exact count needs Groq response headers — estimate is fine)
            estimated_used = len(prompt.split()) + len(response.content.split())
            self.budget.record_usage(estimated_used)
            bus.emit_sync(ScraperEvent(type="llm_success", site="groq"))
            return response.content
        except Exception as e:
            err = str(e)
            if "429" in err or "rate_limit" in err.lower():
                logger.error("Groq rate limited — marking budget as exhausted")
                self.budget.tokens_used = self.budget.daily_limit  # force pause
                bus.emit_sync(ScraperEvent(
                    type="llm_rate_limit",
                    site="groq",
                    detail="HTTP 429 rate limit hit",
                ))
            else:
                logger.error(f"Groq call failed: {e}")
            return None


class GeminiLLMClient:
    """
    Calls Google Gemini API.
    Used as fallback when Groq is unavailable.
    """
    def __init__(self):
        self.api_key = settings.GOOGLE_GEMINI_API_KEY
        self.model = "gemini-2.5-flash"

    async def extract(self, prompt: str, system: str,
                      max_tokens: int = 1500) -> str | None:
        if not self.api_key:
            return None

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
            payload = {
                "system_instruction": {
                    "parts": [{"text": system}]
                },
                "contents": [
                    {
                        "parts": [{"text": prompt}]
                    }
                ],
                "generationConfig": {
                    "maxOutputTokens": max_tokens,
                    "temperature": 0.2
                }
            }

            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(url, json=payload)
                r.raise_for_status()
                data = r.json()
                
                if "candidates" in data and len(data["candidates"]) > 0:
                    content = data["candidates"][0]["content"]["parts"][0]["text"]
                    logger.debug(f"Gemini response: {len(content)} chars")
                    return content
                return None
        except Exception as e:
            logger.warning(f"Gemini call failed: {e}")
            return None


class LLMClient:
    """
    Main interface used everywhere in the codebase.

    Provider chain for EXTRACTION (scraping):
      LM Studio (Qwen) → Groq fallback → Gemini fallback → None (skip)

    Provider chain for REASONING (itinerary):
      Groq → Gemini fallback → LM Studio fallback → error
    """

    def __init__(self):
        self._budget = TokenBudget(
            settings.GROQ_DAILY_TOKEN_LIMIT,
            settings.GROQ_TOKEN_RESET_HOUR,
        )
        self._lmstudio = LMStudioClient()
        self._groq = GroqLLMClient(self._budget)
        self._gemini = GeminiLLMClient()

    async def extract_json(
        self,
        prompt: str,
        system: str,
        max_tokens: int = 1500,
    ) -> dict:
        """
        For scraping extraction. Returns parsed dict or {}.
        Tries LM Studio first, falls back to Groq.
        """
        raw = await self._lmstudio.extract(prompt, system, max_tokens, prefill="{")

        if raw is None:
            logger.info("LM Studio unavailable — trying Groq for extraction")
            raw = await self._groq.extract(prompt, system, max_tokens)

        if raw is None:
            logger.info("Groq unavailable — trying Gemini for extraction")
            raw = await self._gemini.extract(prompt, system, max_tokens)

        if raw is None:
            logger.warning("All LLM providers unavailable for extraction — returning {}")
            return {}

        return self._parse_json(raw)

    async def reason(
        self,
        prompt: str,
        system: str,
        max_tokens: int = 2000,
    ) -> str:
        """
        For itinerary building and reasoning tasks.
        Tries Groq first (stronger), falls back to LM Studio.
        """
        raw = await self._groq.extract(
            prompt, system, max_tokens, estimated_cost=2000
        )

        if raw is None:
            logger.warning("Groq unavailable for reasoning — trying Gemini")
            raw = await self._gemini.extract(prompt, system, max_tokens)

        if raw is None:
            logger.warning("Gemini unavailable for reasoning — using LM Studio")
            raw = await self._lmstudio.extract(prompt, system, max_tokens, prefill="{")

        if raw is None:
            raise RuntimeError("All LLM providers unavailable for reasoning")

        return raw

    def status(self) -> dict:
        return {
            "groq_budget":    self._budget.status(),
            "lmstudio_up":    self._lmstudio._available,
            "lmstudio_model": self._lmstudio.model,
        }

    def _parse_json(self, raw: str) -> dict:
        """Parse JSON from LLM response, handling markdown fences, Qwen think tags, noise, and trailing duplicate blocks."""
        clean = raw.strip()

        # Strip Qwen3's <think>...</think> reasoning blocks (closed)
        clean = re.sub(r'<think>.*?</think>', '', clean, flags=re.DOTALL).strip()
        # Strip unclosed <think> blocks (truncated by max_tokens)
        clean = re.sub(r'<think>.*$', '', clean, flags=re.DOTALL).strip()

        # Strip markdown code fences
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        clean = clean.strip()

        try:
            return json.loads(clean)
        except Exception:
            # Use raw_decode to handle trailing garbage or duplicated blocks
            first_brace = clean.find('{')
            if first_brace != -1:
                try:
                    obj, _ = json.JSONDecoder().raw_decode(clean[first_brace:])
                    if isinstance(obj, dict):
                        return obj
                except Exception:
                    pass

            first_bracket = clean.find('[')
            if first_bracket != -1:
                try:
                    arr, _ = json.JSONDecoder().raw_decode(clean[first_bracket:])
                    if isinstance(arr, list):
                        return {"items": arr}
                except Exception:
                    pass

            logger.warning(f"JSON parse failed. Raw: {raw[:300]}")
            return {}


# Module-level singleton
llm_client = LLMClient()
