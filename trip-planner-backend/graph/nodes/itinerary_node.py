# IMPLEMENTATION NOTE:
# Itinerary node - builds day-by-day travel plan using RAG context.
# CRITICAL: Uses provided places/hotels only, never invents data.
# Falls back to general knowledge if retrieved_context is None.

import json
import logging
from datetime import datetime
from langchain_groq import ChatGroq
from core.config import settings

logger = logging.getLogger(__name__)

llm = ChatGroq(api_key=settings.GROQ_API_KEY, model="llama-3.3-70b-versatile")


async def itinerary_node(state: dict) -> dict:
    """Build itinerary using RAG-retrieved data."""
    req = state["request"]
    retrieved = state.get("retrieved_context")

    # Calculate days
    try:
        start = datetime.strptime(req.start_date, "%Y-%m-%d")
        end = datetime.strptime(req.end_date, "%Y-%m-%d")
        n_days = (end - start).days + 1
    except:
        n_days = 3

    # Calculate budget in INR
    budget_inr = int(req.budget_usd * 83)

    system_prompt = """You are a travel itinerary builder. You will receive real
data about a destination. You must ONLY use places, hotels, and
activities from the provided context. Never invent place names,
prices, coordinates, or hotel names. If the context has fewer
places than days, reuse places at different times of day.
Always output valid JSON matching the schema provided."""

    user_prompt = f"""Destination: {req.destination}
Dates: {req.start_date} to {req.end_date} ({n_days} days)
Budget: ₹{budget_inr:,} total for {req.travelers} people
Style: {req.style}
Origin: {req.origin_city}"""

    # Add retrieved context if available
    if retrieved:
        user_prompt += f"""

AVAILABLE PLACES (use only these):
{json.dumps(retrieved.get('places', [])[:20])}

AVAILABLE HOTELS (use only these):
{json.dumps(retrieved.get('hotels', [])[:10])}

WEATHER FORECAST:
{json.dumps(state.get('weather', {}))}

LOCAL TIPS:
{chr(10).join(retrieved.get('blog_tips', [])[:5])}

LOCAL INSIGHTS:
{chr(10).join(retrieved.get('local_insights', [])[:3])}

UPCOMING EVENTS:
{json.dumps(retrieved.get('events', [])[:5])}"""

        user_prompt += """

Build a day-by-day itinerary JSON with keys:
days (array of {day_number, theme, morning, afternoon, evening,
hotel, estimated_cost_inr}), total_cost_inr, highlights (3 strings),
packing_tips (5 strings based on weather and destination type)"""
    else:
        user_prompt += """

NOTE: Destination data unavailable - itinerary based on general knowledge.
Use your best judgment for the destination."""

        user_prompt += """

Build a day-by-day itinerary JSON with keys:
days (array of {day_number, theme, morning, afternoon, evening,
hotel, estimated_cost_inr}), total_cost_inr, highlights (3 strings),
packing_tips (5 strings based on weather and destination type)"""

    try:
        response = await llm.ainvoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ])

        content = response.content.strip()

        # Parse JSON
        import re
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
        if json_match:
            content = json_match.group(1)

        itinerary = json.loads(content.strip())

        return {"itinerary": itinerary}

    except json.JSONDecodeError as e:
        logger.error(f"Itinerary JSON parse failed: {e}")
        return {
            "itinerary": {"raw": response.content, "parseError": str(e)},
            "warnings": state.get("warnings", []) + ["Itinerary parsing failed"]
        }
    except Exception as e:
        logger.error(f"Itinerary node failed: {e}")
        return {"itinerary": {"error": str(e)}}