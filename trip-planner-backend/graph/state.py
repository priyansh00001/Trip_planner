from typing import TypedDict, Optional, List
from core.models import TripRequest


class TripState(TypedDict):
    request: TripRequest
    weather: Optional[dict]
    flights: Optional[dict]
    places: Optional[dict]
    currency: Optional[dict]
    web_search: Optional[dict]
    hotels: Optional[dict]
    itinerary: Optional[dict]
    errors: List[str]
    final_plan: Optional[dict]
    # RAG pipeline fields
    retrieved_context: Optional[dict]
    budget_breakdown: Optional[dict]
    warnings: List[str]
    validation_report: Optional[dict]
    data_freshness: Optional[str]