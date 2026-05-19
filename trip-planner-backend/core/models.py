from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class TripRequest(BaseModel):
    destination: str
    start_date: str          # "2025-09-10"
    end_date: str            # "2025-09-17"
    budget_usd: float
    origin_city: str         # for flight search
    origin_city_slug: str = ""    # auto-derived if empty
    travelers: int = 1
    style: Optional[str] = "balanced"  # budget / luxury / balanced
    confirmed_stay: Optional[Dict[str, Any]] = None
    selected_places: Optional[List[Dict[str, Any]]] = []
    selected_transport: Optional[Dict[str, Any]] = None
    transport_cost_inr: int = 0
    remaining_budget_inr: int = 0

class TransportOption(BaseModel):
    mode: str
    operator: str
    price_min_inr: int
    price_max_inr: int
    duration_minutes: Optional[int] = None
    departure_times: List[str] = []
    frequency: str = ""
    booking_url: str = ""
    source: str
    data_freshness: str = ""

class TransportSearchResponse(BaseModel):
    origin: str
    destination: str
    options: Dict[str, List[TransportOption]]
    scraping_in_progress: bool
    data_freshness: Optional[str] = None
    message: str = ""

class AgentResult(BaseModel):
    agent: str
    status: str              # "ok" | "error" | "cached"
    data: dict
