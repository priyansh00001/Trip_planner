# IMPLEMENTATION NOTE:
# Main retrieval class for RAG-based agent pipeline.
# Fetches destination data from Supabase and FAISS indexes.
# Returns structured RetrievalResult for itinerary generation.

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import Optional

from core.supabase_client import db
from rag.embedder import embed_query
from rag.faiss_index import places_index, hotels_index, blogs_index

logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    """Result of destination data retrieval."""
    destination: dict
    places: list[dict] = field(default_factory=list)
    hotels: list[dict] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)
    news: list[dict] = field(default_factory=list)
    blog_tips: list[str] = field(default_factory=list)
    local_insights: list[str] = field(default_factory=list)
    data_freshness: str = ""
    token_estimate: int = 0

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict."""
        return asdict(self)


class DestinationRetriever:
    """Retrieves destination content for RAG-powered itinerary generation."""

    async def retrieve(
        self,
        destination_slug: str,
        user_query: str,
        budget_tier: str,
        trip_dates: tuple,
        max_tokens: int = 5000
    ) -> RetrievalResult:
        """Retrieve all destination data for itinerary generation."""
        logger.info(f"Retrieving context for {destination_slug}")
        result = RetrievalResult(destination={})

        # Step 1: Fetch destination
        dest_response = db.table("destinations").select("*").eq(
            "slug", destination_slug
        ).execute()

        if not dest_response.data:
            raise ValueError(f"Destination not found: {destination_slug}")

        destination = dest_response.data[0]
        result.destination = destination
        destination_id = destination["id"]

        # Step 2: Embed query
        query_vector = embed_query(destination_slug, user_query, budget_tier)

        # Step 3: Search places index
        place_ids = []
        place_results = places_index.search(query_vector, k=20)
        for record_id, score in place_results:
            place_ids.append(record_id)

        if place_ids:
            places_response = db.table("places").select("*").in_(
                "id", place_ids
            ).eq("destination_id", destination_id).execute()

            # Filter to this destination and sort by fee if budget
            places = places_response.data or []
            if budget_tier == "budget":
                places.sort(key=lambda x: x.get("entry_fee_inr", 0))
            result.places = places

        # Step 4: Search hotels index
        hotel_ids = []
        hotel_results = hotels_index.search(query_vector, k=15)
        for record_id, score in hotel_results:
            hotel_ids.append(record_id)

        if hotel_ids:
            hotels_response = db.table("hotels").select("*").in_(
                "id", hotel_ids
            ).eq("destination_id", destination_id).execute()

            # Filter and sort by price
            hotels = [h for h in (hotels_response.data or []) if not h.get("is_stale", False)]
            hotels.sort(key=lambda x: x.get("price_min_inr", 999999))
            result.hotels = hotels[:15]

        logger.info(f"Found {len(result.places)} places, {len(result.hotels)} hotels from DB")

        # Step 5: Fetch events
        now = datetime.utcnow()
        ninety_days_later = now + timedelta(days=90)

        events_response = db.table("local_events").select("*").eq(
            "destination_id", destination_id
        ).execute()

        upcoming_events = []
        for event in (events_response.data or []):
            start_date = event.get("start_date")
            is_recurring = event.get("is_recurring", False)

            if is_recurring:
                upcoming_events.append(event)
            elif start_date:
                try:
                    start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                    if now <= start_dt <= ninety_days_later:
                        upcoming_events.append(event)
                except:
                    pass

        result.events = upcoming_events[:10]

        # Step 6: Fetch news
        news_response = db.table("news_alerts").select("*").eq(
            "destination_id", destination_id
        ).gte("expires_at", now.isoformat()).order(
            "severity"
        ).order("published_at", desc=True).limit(5).execute()

        result.news = news_response.data or []

        # Step 7: Search blogs index
        blog_ids = []
        blog_results = blogs_index.search(query_vector, k=5)
        for record_id, score in blog_results:
            blog_ids.append(record_id)

        if blog_ids:
            blogs_response = db.table("blogs_and_guides").select(
                "key_tips, local_insights"
            ).in_("id", blog_ids).execute()

            for blog in (blogs_response.data or []):
                result.blog_tips.extend(blog.get("key_tips", []))
                result.local_insights.extend(blog.get("local_insights", []))

        # Step 8: Token budget enforcement
        result.token_estimate = self._estimate_tokens(result)

        if result.token_estimate > max_tokens:
            # Trim: keep top 10 places, top 5 hotels, top 3 blogs tips/insights
            result.places = result.places[:10]
            result.hotels = result.hotels[:5]
            result.blog_tips = result.blog_tips[:15]
            result.local_insights = result.local_insights[:10]
            result.token_estimate = self._estimate_tokens(result)

        logger.info(f"Token estimate: {result.token_estimate}")

        # Step 9: Calculate data freshness
        result.data_freshness = self._get_data_freshness(
            destination_id, result.places, result.hotels
        )

        return result

    def _estimate_tokens(self, result: RetrievalResult) -> int:
        """Estimate token count from JSON data."""
        data = json.dumps(result.to_dict())
        return len(data) // 4

    def _get_data_freshness(self, destination_id: str, places: list, hotels: list) -> str:
        """Get ISO timestamp of oldest scraped_at in result."""
        from core.supabase_client import db

        timestamps = []

        # Check destination
        dest_response = db.table("destinations").select("scraped_at").eq(
            "id", destination_id
        ).execute()
        if dest_response.data and dest_response.data[0].get("scraped_at"):
            timestamps.append(dest_response.data[0]["scraped_at"])

        # Check places
        if places:
            place_ids = [p["id"] for p in places]
            places_response = db.table("places").select("scraped_at").in_(
                "id", place_ids
            ).execute()
            for p in places_response.data:
                if p.get("scraped_at"):
                    timestamps.append(p["scraped_at"])

        # Check hotels
        if hotels:
            hotel_ids = [h["id"] for h in hotels]
            hotels_response = db.table("hotels").select("scraped_at").in_(
                "id", hotel_ids
            ).execute()
            for h in hotels_response.data:
                if h.get("scraped_at"):
                    timestamps.append(h["scraped_at"])

        if not timestamps:
            return datetime.utcnow().isoformat()

        # Return oldest timestamp
        oldest = min(timestamps)
        return oldest