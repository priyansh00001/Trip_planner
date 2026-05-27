"""
Trip Planner Orchestrator — LangGraph state machine.

Refactored to use separate node files from graph/nodes/.

Execution order:
  ┌──────────────┐
  │    START     │
  └──┬────────────┘
     │
     → retriever_node    (loads destination data from RAG)
     │
     → weather_node      (parallel with flight_node)
     → flight_node       (parallel with weather_node)
     │
     → itinerary_node    (waits for retriever, weather, flight)
     │
     → budget_node       (calculates budget breakdown)
     │
     → validator_node    (validates against retrieved context)
     │
     → assemble → END
"""

from langgraph.graph import StateGraph, START, END
from graph.state import TripState
from graph.nodes import (
    retriever_node,
    weather_node,
    flight_node,
    itinerary_node,
    budget_node,
    validator_node,
)
from agents.currency_agent import CurrencyAgent
from agents.web_search_agent import WebSearchAgent
from core.config import settings
import json, logging

logger = logging.getLogger(__name__)


# ─────────────────────────── assemble function (kept inline) ─────────────────

async def assemble_final(state: TripState) -> dict:
    """Merge everything into final_plan with booking links."""
    itinerary = state.get("itinerary", {}) or {}

    # Add hotels from LiteAPI if available
    hotels_data = state.get("hotels") or {}
    liteapi_hotels = hotels_data.get("hotels", [])
    if liteapi_hotels and isinstance(itinerary, dict):
        existing_stays = itinerary.get("recommendedStays", [])
        for h in liteapi_hotels[:3]:
            existing_stays.append({
                "name": h.get("name", ""),
                "type": "Hotel",
                "price": f"₹{h.get('price_per_night_inr', '?'):,}/night" if isinstance(h.get('price_per_night_inr'), (int, float)) else "Check site",
                "rating": h.get("star_rating"),
                "whyStay": "Found via LiteAPI — click to view current rates.",
                "bookingLink": h.get("booking_link", ""),
            })
        itinerary["recommendedStays"] = existing_stays

    # Attach booking links
    flights = state.get("flights") or {}
    itinerary["bookingLinks"] = {
        "flights": flights.get("booking_link", ""),
        "hotels": hotels_data.get("booking_link", ""),
    }

    # Build final plan with metadata
    final = {
        **itinerary,
        "_meta": {
            "weather": state.get("weather"),
            "flights": state.get("flights"),
            "hotels": state.get("hotels"),
            "places": state.get("places"),
            "currency": state.get("currency"),
            "web_search": state.get("web_search"),
            "retrieved_context": state.get("retrieved_context"),
            "budget_breakdown": state.get("budget_breakdown"),
            "validation_report": state.get("validation_report"),
            "warnings": state.get("warnings", []),
            "data_freshness": state.get("data_freshness"),
        },
    }
    return {"final_plan": final}


# ─────────────────────────── legacy parallel agents (kept for now) ─────────

async def run_currency(state: TripState) -> dict:
    result = await CurrencyAgent().run(state)
    return {"currency": result.data}


async def run_web_search(state: TripState) -> dict:
    result = await WebSearchAgent().run(state)
    return {"web_search": result.data}


# ─────────────────────────── graph assembly ───────────────────────────────────

def build_graph():
    g = StateGraph(TripState)

    # Register all nodes
    g.add_node("retriever", retriever_node.retriever_node)
    g.add_node("weather", weather_node.weather_node)
    g.add_node("flights", flight_node.flight_node)
    g.add_node("currency", run_currency)
    g.add_node("web_search", run_web_search)
    g.add_node("itinerary", itinerary_node.itinerary_node)
    g.add_node("budget", budget_node.budget_node)
    g.add_node("validator", validator_node.validator_node)
    g.add_node("assemble", assemble_final)

    # Flow: START -> retriever -> [weather, flights] in parallel
    g.add_edge(START, "retriever")
    g.add_edge("retriever", "weather")
    g.add_edge("retriever", "flights")

    # Optional: currency and web_search run in parallel too
    g.add_edge("retriever", "currency")
    g.add_edge("retriever", "web_search")

    # All nodes feed into itinerary
    g.add_edge("weather", "itinerary")
    g.add_edge("flights", "itinerary")
    g.add_edge("currency", "itinerary")
    g.add_edge("web_search", "itinerary")

    # Itinerary -> budget -> validator -> assemble -> END
    g.add_edge("itinerary", "budget")
    g.add_edge("budget", "validator")
    g.add_edge("validator", "assemble")
    g.add_edge("assemble", END)

    return g.compile()


trip_graph = build_graph()