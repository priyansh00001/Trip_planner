# IMPLEMENTATION NOTE:
# Retriever node - loads destination content from RAG pipeline.
# Uses FAISS indexes and Supabase to fetch places, hotels, events, news, blogs.
# Falls back gracefully if retrieval fails.

import logging
from rag.retriever import DestinationRetriever

logger = logging.getLogger(__name__)


async def retriever_node(state: dict) -> dict:
    """Load destination data using RAG retriever."""
    try:
        req = state["request"]

        # Instantiate retriever
        retriever = DestinationRetriever()

        # Retrieve content
        result = await retriever.retrieve(
            destination_slug=req.destination.lower().replace(" ", "-"),
            user_query=req.style or "balanced travel",
            budget_tier=req.style or "mid",
            trip_dates=(req.start_date, req.end_date),
            max_tokens=5000
        )

        logger.info(f"Retrieved context for {req.destination}: "
                   f"{len(result.places)} places, {len(result.hotels)} hotels")

        return {
            "retrieved_context": result.to_dict(),
            "data_freshness": result.data_freshness,
        }

    except ValueError as e:
        logger.warning(f"Retriever node failed: {e}")
        return {
            "retrieved_context": None,
            "warnings": state.get("warnings", []) + [f"Could not load destination data: {str(e)}"],
        }
    except Exception as e:
        logger.error(f"Retriever node error: {e}")
        return {
            "retrieved_context": None,
            "warnings": state.get("warnings", []) + ["Could not load destination data"],
        }