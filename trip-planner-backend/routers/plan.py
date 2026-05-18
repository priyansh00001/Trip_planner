from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from core.models import TripRequest
from graph.orchestrator import trip_graph
from graph.state import TripState
from vector_store.faiss_store import trip_store
import json, asyncio, os

router = APIRouter()

# Human-readable status messages
NODE_STATUS_MESSAGES = {
    "retriever": "Loading destination data...",
    "weather": "Fetching weather forecast...",
    "flights": "Checking flight options...",
    "currency": "Getting currency rates...",
    "web_search": "Researching destination...",
    "itinerary": "Building your itinerary...",
    "budget": "Calculating budget breakdown...",
    "validator": "Validating itinerary...",
    "assemble": "Finalizing your trip...",
}


@router.post("/plan")
async def plan_trip(
    req: TripRequest,
    x_internal_token: str | None = Header(None, alias="X-Internal-Token"),
):
    # Validate internal token when configured
    # This prevents direct internet access to the expensive LLM pipeline.
    expected_token = os.environ.get("INTERNAL_API_TOKEN", "")
    if expected_token and x_internal_token != expected_token:
        raise HTTPException(status_code=403, detail="Forbidden")
    # Check vector store cache first
    days = (
        (lambda a, b: abs((
            __import__("datetime").date.fromisoformat(b) -
            __import__("datetime").date.fromisoformat(a)
        ).days))(req.start_date, req.end_date)
    )
    cached = trip_store.search(req.destination, req.style, days)
    if cached:
        async def cached_stream():
            yield {"event": "status", "data": json.dumps({"agent": "cache", "status": "hit", "message": "Loaded from cache"})}
            yield {"event": "result", "data": json.dumps(cached)}
        return EventSourceResponse(cached_stream())

    async def event_stream():
        initial_state: TripState = {
            "request": req,
            "weather": None, "flights": None,
            "places": None, "currency": None,
            "web_search": None, "hotels": None,
            "itinerary": None, "errors": [], "final_plan": None,
            # RAG pipeline fields
            "retrieved_context": None,
            "budget_breakdown": None,
            "warnings": [],
            "validation_report": None,
            "data_freshness": None,
        }
        yield {"event": "status", "data": json.dumps({"agent": "orchestrator", "status": "started", "message": "Starting trip planning..."})}

        async for chunk in trip_graph.astream(initial_state):
            node_name = list(chunk.keys())[0]
            message = NODE_STATUS_MESSAGES.get(node_name, f"Running {node_name}...")
            yield {"event": "status", "data": json.dumps({"agent": node_name, "status": "done", "message": message})}
            await asyncio.sleep(0)

        # Get final state
        final = await trip_graph.ainvoke(initial_state)
        plan = final.get("final_plan", {})

        # Add data_freshness from final state
        data_freshness = final.get("data_freshness")
        if data_freshness:
            plan["data_freshness"] = data_freshness

        # Save to vector store for future cache hits
        trip_store.add_trip(req.destination, req.style, days, plan)

        yield {"event": "result", "data": json.dumps(plan)}

    return EventSourceResponse(event_stream())