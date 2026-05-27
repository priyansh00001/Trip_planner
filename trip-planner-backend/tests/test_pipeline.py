"""
Full LangGraph pipeline integration test.
"""
import pytest
from graph.orchestrator import trip_graph
from graph.state import TripState
from core.models import TripRequest


@pytest.mark.asyncio
async def test_full_pipeline_jaipur():
    """Test full pipeline end to end for Jaipur."""
    initial_state = TripState(
        request=TripRequest(
            destination="Jaipur",
            start_date="2025-11-01",
            end_date="2025-11-05",
            budget_usd=500,
            origin_city="DEL",
            travelers=2,
            style="mid"
        ),
        weather=None,
        flights=None,
        places=None,
        currency=None,
        web_search=None,
        hotels=None,
        retrieved_context=None,
        itinerary=None,
        budget_breakdown=None,
        warnings=[],
        validation_report=None,
        data_freshness=None,
        errors=[],
        final_plan=None
    )

    # This makes real API calls - expect 15-30 seconds
    result = await trip_graph.ainvoke(initial_state)

    # Assert pipeline completed
    assert result is not None
    assert result.get("final_plan") is not None

    import json
    with open("test_output.json", "w", encoding="utf-8") as f:
        json.dump({"errors": result.get("errors"), "final_plan": result.get("final_plan")}, f, default=str)
    final = result["final_plan"]

    # Assert itinerary structure - final_plan contains itinerary data directly
    assert "days" in final
    assert len(final["days"]) >= 1

    # Assert each day has required keys
    for day in final["days"]:
        assert "day_number" in day or "dayNumber" in day

    # Assert budget breakdown exists
    assert "budget_breakdown" in final.get("_meta", {})

    # Assert weather ran (in _meta)
    assert "weather" in final.get("_meta", {})

    # Assert validation ran (in _meta)
    validation_report = final.get("_meta", {}).get("validation_report")
    assert validation_report is not None

    # Print summary for manual review
    print(f"Days generated: {len(final['days'])}")
    print(f"Highlights: {final.get('highlights', [])}")
    print(f"Warnings: {result.get('warnings', [])}")
    print(f"Validation: {validation_report}")