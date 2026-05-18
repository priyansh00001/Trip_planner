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

    system_prompt = """You are India's #1 travel expert and local guide. You have encyclopedic knowledge of every famous cafe, restaurant, beach, temple, museum, market, trek, and hidden gem across India.
You will build a hyper-detailed, day-by-day travel plan using real places, hotels, and activities.
You must ONLY use the places and activities from the provided context (RAG context + user's selected places).
Never invent fake place names, coordinates, or hotel names.

CRITICAL RULES:
1. Every place name MUST be a real, existing establishment in the destination.
2. Group activities logically into: Morning → Afternoon → Evening.
3. Every activity MUST have real, accurate GPS coordinates (lat/lng) as numbers. Do NOT reuse coordinates across activities; each activity must have its actual unique coordinates.
4. For cafes/restaurants, always include a specific "signatureDish".
5. For activities, always provide a specific "proTip" (e.g. "Visit at 5 PM for sunset views").
6. For every outdoor activity, provide an "indoorAlternative" (e.g. in case of heavy rain).
7. Provide a "streetFood" array with 3 local street foods to try, their hints, and descriptions.
8. Provide a "localTips" object containing "etiquette" (at least 2 items) and "scamsToAvoid" (at least 2 items).

You MUST output ONLY a valid JSON object matching the exact schema:
{
  "tripTitle": "Catchy exciting title",
  "destination": "Name of destination",
  "estimatedCost": "₹XXXXX",
  "highlights": ["Highlight 1", "Highlight 2"],
  "bestTimeToVisit": "e.g. October - March",
  "streetFood": [
    {
      "name": "Street Food Name",
      "location_hint": "Where to find it",
      "description": "Why try it"
    }
  ],
  "localTips": {
    "etiquette": ["Rule 1", "Rule 2"],
    "scamsToAvoid": ["Scam 1", "Scam 2"]
  },
  "days": [
    {
      "dayNumber": 1,
      "theme": "Catchy theme of the day",
      "activities": [
        {
          "time": "Morning/Afternoon/Evening",
          "name": "REAL place name",
          "category": "Cafe/Beach/Temple/Museum/Market/Trek/Viewpoint/Club/Heritage/Park/etc",
          "rating": 4.5,
          "description": "Short description of what they will do",
          "whyVisit": "Short one-liner on why it's famous",
          "signatureDish": "Signature dish if food place, otherwise null",
          "proTip": "Pro-tip if monument/activity, otherwise null",
          "indoorAlternative": {
            "name": "Real Indoor Alternative Place",
            "description": "Why go here if it rains"
          },
          "costEstimate": "₹XXX",
          "icon": "Coffee/MapPin/Building2/Compass/Utensils/Mountain",
          "lat": 28.6139,
          "lng": 77.2090
        }
      ]
    }
  ]
}"""

    # Build stay context
    confirmed_stay = getattr(req, "confirmed_stay", None)
    if confirmed_stay:
        stay_context = f"""
STAY CONTEXT (THE HOTEL IS CONFIRMED):
The traveler has already booked their stay at: "{confirmed_stay.get('name')}" ({confirmed_stay.get('type')}) located at {confirmed_stay.get('address', req.destination)}.
Plan all activities to logically start and end near this basecamp each day. DO NOT recommend stays or hotels in the daily itinerary."""
    else:
        stay_context = f"They prefer staying in a place matching style: {req.style}."

    # Build selected places context
    selected_places = getattr(req, "selected_places", []) or []
    if selected_places:
        selected_places_context = f"""
MUST-INCLUDE PLACES (The traveler personally picked these — they MUST appear in the itinerary):
{json.dumps(selected_places, indent=2)}

You must distribute these selected places logically across the {n_days} days of the itinerary, and fill in the rest of the day with other highly rated places from the retrieved context or general knowledge."""
    else:
        selected_places_context = "Select the best places from the context to plan a memorable trip."

    user_prompt = f"""Destination: {req.destination}
Dates: {req.start_date} to {req.end_date} ({n_days} days)
Budget: ₹{budget_inr:,} total for {req.travelers} people
Style: {req.style}
Origin: {req.origin_city}

{stay_context}

{selected_places_context}"""

    # Add retrieved context if available
    if retrieved:
        user_prompt += f"""

AVAILABLE PLACES (use only these to supplement):
{json.dumps(retrieved.get('places', [])[:20])}

AVAILABLE HOTELS:
{json.dumps(retrieved.get('hotels', [])[:10])}

WEATHER FORECAST:
{json.dumps(state.get('weather', {}))}

LOCAL TIPS:
{chr(10).join(retrieved.get('blog_tips', [])[:5])}

LOCAL INSIGHTS:
{chr(10).join(retrieved.get('local_insights', [])[:3])}

UPCOMING EVENTS:
{json.dumps(retrieved.get('events', [])[:5])}"""

        user_prompt += "\n\nBuild the day-by-day itinerary JSON matching the exact schema."
    else:
        user_prompt += """

NOTE: Destination data unavailable - itinerary based on general knowledge.
Use your best judgment for the destination.

Build the day-by-day itinerary JSON matching the exact schema."""

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