"""
WebSearchAgent — enriches itinerary with real-world destination facts.

Uses two completely FREE, no-key-required APIs:
  1. DuckDuckGo Instant Answer API  →  quick facts, abstract, related topics
  2. Wikipedia REST API             →  full extract: history, culture, geography

The combined text is fed to the LLM to extract structured facts
(best time to visit, local tips, safety notes, etc.).
"""

from agents.base_agent import BaseAgent
from core.llm_client import llm_client
import httpx, json, logging

logger = logging.getLogger(__name__)


class WebSearchAgent(BaseAgent):
    name = "web_search"

    async def fetch(self, state: dict) -> dict:
        destination = state["request"].destination.strip()
        raw: dict = {}

        # ── 1. DuckDuckGo Instant Answer (no key, always available) ──────────
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(
                    "https://api.duckduckgo.com/",
                    params={
                        "q":           f"{destination} travel guide",
                        "format":      "json",
                        "no_redirect": "1",
                        "no_html":     "1",
                        "skip_disambig": "1",
                    },
                )
                ddg = r.json()
                raw["ddg_abstract"] = ddg.get("AbstractText", "")
                raw["ddg_topics"]   = [
                    t.get("Text", "")
                    for t in ddg.get("RelatedTopics", [])[:6]
                    if isinstance(t, dict)
                ]
        except Exception as e:
            logger.warning(f"WebSearchAgent: DuckDuckGo failed — {e}")
            raw["ddg_abstract"] = ""
            raw["ddg_topics"]   = []

        # ── 2. Wikipedia REST API (no key, no rate limit for casual use) ─────
        wiki_title = destination.replace(" ", "_")
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{wiki_title}",
                    headers={"User-Agent": "TripPlannerBot/1.0 (educational project)"},
                )
                if r.status_code == 200:
                    wiki = r.json()
                    raw["wiki_summary"] = wiki.get("extract", "")
                else:
                    raw["wiki_summary"] = ""
        except Exception as e:
            logger.warning(f"WebSearchAgent: Wikipedia failed — {e}")
            raw["wiki_summary"] = ""

        # ── 3. LLM: extract structured travel facts from raw data ────────────
        has_data = raw.get("ddg_abstract") or raw.get("wiki_summary")

        if not has_data:
            logger.warning(f"WebSearchAgent: No source data found for '{destination}'")
            return {
                "destination": destination,
                "extracted_facts": {},
                "sources_used": [],
            }

        prompt = f"""
You are a travel research assistant. Extract structured facts about "{destination}" 
from the following real web data. Return ONLY valid JSON, no markdown.

DDG Abstract: {raw['ddg_abstract']}
DDG Topics:   {raw['ddg_topics']}
Wikipedia:    {raw['wiki_summary'][:2000]}

Return a JSON object with exactly these keys:
{{
  "best_time_to_visit": "string — month range and why",
  "local_tips": ["5 short actionable tips for travellers"],
  "cultural_notes": "string — etiquette, customs, dress code if relevant",
  "safety_notes": "string — any important safety advice",
  "avg_daily_budget_inr": <number — estimated INR per person per day>,
  "known_for": ["3-5 things this destination is famous for"],
  "language": "primary local language"
}}
"""
        try:
            extracted = await llm_client.extract_json(
                prompt=prompt,
                system="Extract structured travel facts. Return only valid JSON.",
                max_tokens=4000,
            )
            if not extracted:
                extracted = {}
        except Exception as e:
            logger.warning(f"WebSearchAgent: LLM extraction failed — {e}")
            extracted = {}

        return {
            "destination":     destination,
            "ddg_abstract":    raw["ddg_abstract"],
            "wiki_excerpt":    raw["wiki_summary"][:500],   # trimmed for state size
            "extracted_facts": extracted,
            "sources_used":    [s for s in ["duckduckgo", "wikipedia"] if raw.get(f"{s.replace('duckduckgo','ddg')}_abstract") or raw.get("wiki_summary")],
        }
