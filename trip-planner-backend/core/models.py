from pydantic import BaseModel
from typing import Optional

class TripRequest(BaseModel):
    destination: str
    start_date: str          # "2025-09-10"
    end_date: str            # "2025-09-17"
    budget_usd: float
    origin_city: str         # for flight search
    travelers: int = 1
    style: Optional[str] = "balanced"  # budget / luxury / balanced

class AgentResult(BaseModel):
    agent: str
    status: str              # "ok" | "error" | "cached"
    data: dict
