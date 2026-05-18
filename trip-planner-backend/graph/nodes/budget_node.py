# IMPLEMENTATION NOTE:
# Budget node - calculates and validates budget breakdown.
# Compares estimated total vs user's budget, warns if over by >10%.

import logging

logger = logging.getLogger(__name__)


async def budget_node(state: dict) -> dict:
    """Calculate budget breakdown and validate against user budget."""
    from core.supabase_client import db

    req = state["request"]
    itinerary = state.get("itinerary", {})
    retrieved = state.get("retrieved_context")

    # Calculate days
    try:
        start_date = req.start_date
        end_date = req.end_date
        from datetime import datetime
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        n_days = (end - start).days + 1
    except:
        n_days = 3

    budget_inr = req.budget_usd * 83

    # Get hotel cost
    hotels = itinerary.get("days", [])
    hotel_cost = 0
    for day in hotels:
        day_hotel = day.get("hotel")
        if day_hotel:
            try:
                hotel_cost += int(day_hotel.get("estimated_cost_inr", 0))
            except:
                pass
    if hotel_cost == 0:
        # Use cheapest hotel from retrieved context
        if retrieved and retrieved.get("hotels"):
            cheapest = min(
                retrieved["hotels"],
                key=lambda h: h.get("price_min_inr", 999999)
            )
            hotel_cost = cheapest.get("price_min_inr", 0) * n_days

    # Estimate entry fees
    entry_fees = 0
    for day in hotels:
        for activity in day.get("activities", []):
            fee_str = activity.get("costEstimate", "₹0")
            try:
                fee = int(fee_str.replace("₹", "").replace(",", ""))
                entry_fees += fee
            except:
                pass

    # Food estimate (30% of daily budget)
    budget_tier = req.style or "mid"
    daily_food = {"budget": 400, "mid": 800, "premium": 1500}.get(budget_tier, 800)
    food_cost = daily_food * n_days * req.travelers

    # Transport estimate (based on distance)
    transport_cost = 1500 * n_days  # flat estimate

    total_estimated = hotel_cost + entry_fees + food_cost + transport_cost

    breakdown = {
        "hotel": hotel_cost,
        "entry_fees": entry_fees,
        "food": food_cost,
        "transport": transport_cost,
        "total_estimated": total_estimated,
        "user_budget": int(budget_inr),
    }

    warnings = list(state.get("warnings", []))

    # Check if over budget
    if total_estimated > budget_inr * 1.1:
        over_by = total_estimated - budget_inr
        warnings.append(f"Estimated cost ₹{total_estimated:,} exceeds budget by ₹{over_by:,}")

    return {
        "budget_breakdown": breakdown,
        "warnings": warnings,
    }


# Import datetime for calculation
from datetime import datetime