# IMPLEMENTATION NOTE:
# Validator node - validates itinerary against retrieved context.
# Uses fuzzy matching (difflib) to detect hallucinated places/hotels.
# Removes or replaces invalid entries.

import logging
import difflib

logger = logging.getLogger(__name__)


async def validator_node(state: dict) -> dict:
    """Validate itinerary against retrieved context."""
    itinerary = state.get("itinerary", {})
    retrieved = state.get("retrieved_context")

    if not itinerary or not retrieved:
        logger.info("Validator: No retrieved context to validate against")
        return {
            "itinerary": itinerary,
            "validation_report": {"removed_count": 0, "total_places": 0, "note": "No context to validate"},
        }

    # Build valid places list
    valid_places = {}
    for place in retrieved.get("places", []):
        name = place.get("name", "").lower().strip()
        if name:
            valid_places[name] = place

    # Whitelist user-selected places so fuzzy matching doesn't remove them!
    req = state.get("request")
    if req:
        selected_places = getattr(req, "selected_places", []) or []
        for place in selected_places:
            name = place.get("name", "").lower().strip()
            if name:
                valid_places[name] = place

    # Build valid hotels list
    valid_hotels = {}
    for hotel in retrieved.get("hotels", []):
        name = hotel.get("name", "").lower().strip()
        if name:
            valid_hotels[name] = hotel

    removed_count = 0
    total_places_checked = 0
    total_hotels_checked = 0

    # Validate each day
    days = itinerary.get("days", [])
    cleaned_days = []

    for day in days:
        cleaned_day = dict(day)
        cleaned_activities = []

        for activity in day.get("activities", []):
            total_places_checked += 1
            activity_name = activity.get("name", "").lower().strip()

            if not activity_name:
                cleaned_activities.append(activity)
                continue

            # Fuzzy match against valid places
            best_match = None
            best_score = 0

            for valid_name in valid_places.keys():
                score = difflib.get_close_matches(
                    activity_name,
                    [valid_name],
                    n=1,
                    cutoff=0.6
                )
                if score:
                    score_val = difflib.SequenceMatcher(None, activity_name, valid_name).ratio()
                    if score_val > best_score:
                        best_score = score_val
                        best_match = valid_name

            if best_match:
                cleaned_activities.append(activity)
            else:
                removed_count += 1
                logger.warning(f"Validator: Removing hallucinated place '{activity_name}'")

        cleaned_day["activities"] = cleaned_activities

        # Validate hotel
        day_hotel = day.get("hotel")
        if day_hotel:
            hotel_name = day_hotel.get("name", "").lower().strip() if isinstance(day_hotel, dict) else ""
            if hotel_name:
                total_hotels_checked += 1
                best_match = None
                for valid_name in valid_hotels.keys():
                    score = difflib.get_close_matches(
                        hotel_name,
                        [valid_name],
                        n=1,
                        cutoff=0.6
                    )
                    if score:
                        best_match = valid_name

                if not best_match:
                    # Remove invalid hotel
                    cleaned_day["hotel"] = None
                    removed_count += 1
                    logger.warning(f"Validator: Removing hallucinated hotel '{hotel_name}'")

        cleaned_days.append(cleaned_day)

    # Update itinerary
    itinerary["days"] = cleaned_days

    report = {
        "removed_count": removed_count,
        "total_places": total_places_checked,
        "total_hotels": total_hotels_checked,
    }

    logger.info(f"Validator: Removed {removed_count} hallucinated entries out of "
               f"{total_places_checked} places")

    return {
        "itinerary": itinerary,
        "validation_report": report,
    }