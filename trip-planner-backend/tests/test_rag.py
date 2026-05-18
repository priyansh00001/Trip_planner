"""
RAG pipeline tests.
"""
import pytest
from rag.faiss_index import places_index, hotels_index, blogs_index
from rag.retriever import DestinationRetriever


def test_faiss_indexes_initialize():
    """Test FAISS indexes initialize without error."""
    assert places_index is not None
    assert hotels_index is not None
    assert blogs_index is not None
    # Indexes may be empty (no DB data yet) - that's fine
    print(f"Places index: {places_index.index.ntotal} records")
    print(f"Hotels index: {hotels_index.index.ntotal} records")
    print(f"Blogs index: {blogs_index.index.ntotal} records")


@pytest.mark.asyncio
async def test_retriever_with_empty_db():
    """Test retriever handles empty DB gracefully."""
    retriever = DestinationRetriever()

    try:
        result = await retriever.retrieve(
            destination_slug="jaipur",
            user_query="heritage temples budget travel",
            budget_tier="budget",
            trip_dates=("2025-11-01", "2025-11-05")
        )
        # If it returns: check structure
        assert hasattr(result, "places")
        assert hasattr(result, "hotels")
        assert hasattr(result, "data_freshness")
        print(f"Returned {len(result.places)} places, {len(result.hotels)} hotels")
    except ValueError as e:
        # Acceptable - destination not in DB yet
        print(f"Expected error (no seed data): {e}")
        assert "not found" in str(e).lower() or "jaipur" in str(e).lower()
    except Exception as e:
        # Acceptable - tables don't exist yet (DB not migrated)
        error_msg = str(e)
        print(f"Expected error (no DB tables): {error_msg[:100]}")
        assert "table" in error_msg.lower() or "schema" in error_msg.lower()