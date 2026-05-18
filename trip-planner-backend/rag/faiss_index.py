# IMPLEMENTATION NOTE:
# FAISS indexes for RAG content (places, hotels, blogs, events).
# Each content type has its own index for independent retrieval.
# Persisted to data/faiss/{name}.faiss and data/faiss/{name}_meta.pkl

import faiss
import numpy as np
import os
import pickle
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

FAISS_DIR = "data/faiss"
DIM = 384  # all-MiniLM-L6-v2 output dim


class ContentIndex:
    """FAISS index for a specific content type."""

    def __init__(self, name: str, dim: int = DIM):
        self.name = name
        self.dim = dim
        self.index: faiss.Index | None = None
        self.metadata: List[dict] = []
        self._load()

    def _load(self):
        """Load index and metadata from disk if exists."""
        index_path = os.path.join(FAISS_DIR, f"{self.name}.faiss")
        meta_path = os.path.join(FAISS_DIR, f"{self.name}_meta.pkl")

        if os.path.exists(index_path) and os.path.exists(meta_path):
            try:
                self.index = faiss.read_index(index_path)
                with open(meta_path, "rb") as f:
                    self.metadata = pickle.load(f)
                logger.info(f"Loaded {self.name} index with {len(self.metadata)} records")
            except Exception as e:
                logger.warning(f"Failed to load {self.name} index: {e}")
                self._init_empty()
        else:
            self._init_empty()

    def _init_empty(self):
        """Initialize empty index."""
        self.index = faiss.IndexFlatIP(self.dim)
        self.metadata = []

    def add(self, record_id: str, vector: np.ndarray):
        """Add a record to the index."""
        vec = vector.reshape(1, -1).astype("float32")
        self.index.add(vec)
        self.metadata.append({"id": record_id})

    def search(self, query_vector: np.ndarray, k: int = 10, threshold: float = 0.72) -> List[Tuple[str, float]]:
        """Search the index, return list of (record_id, score) above threshold."""
        if self.index.ntotal == 0:
            return []

        vec = query_vector.reshape(1, -1).astype("float32")
        scores, indices = self.index.search(vec, k=k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and score >= threshold:
                record_id = self.metadata[idx]["id"]
                results.append((record_id, float(score)))

        # Sort by score descending
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def save(self):
        """Save index and metadata to disk."""
        os.makedirs(FAISS_DIR, exist_ok=True)

        index_path = os.path.join(FAISS_DIR, f"{self.name}.faiss")
        meta_path = os.path.join(FAISS_DIR, f"{self.name}_meta.pkl")

        faiss.write_index(self.index, index_path)
        with open(meta_path, "wb") as f:
            pickle.dump(self.metadata, f)

        logger.info(f"Saved {self.name} index with {len(self.metadata)} records")

    def rebuild_needed(self) -> bool:
        """Check if index needs rebuild."""
        index_path = os.path.join(FAISS_DIR, f"{self.name}.faiss")
        meta_path = os.path.join(FAISS_DIR, f"{self.name}_meta.pkl")

        if not os.path.exists(index_path) or not os.path.exists(meta_path):
            return True

        if self.index is None or self.index.ntotal != len(self.metadata):
            return True

        return False


# Module-level singletons
places_index = ContentIndex("places")
hotels_index = ContentIndex("hotels")
blogs_index = ContentIndex("blogs")


def rebuild_indexes_from_db():
    """Rebuild all RAG indexes from Supabase database."""
    from core.supabase_client import db
    from rag.embedder import embed_place, embed_hotel, embed_blog

    logger.info("Starting RAG index rebuild from database...")

    # Rebuild places index
    try:
        places_response = db.table("places").select(
            "id, name, category, description, tags"
        ).execute()

        if places_response.data:
            places_index._init_empty()
            for place in places_response.data:
                vector = embed_place(place)
                places_index.add(place["id"], vector)
            places_index.save()
            logger.info(f"Indexed {len(places_response.data)} places")
    except Exception as e:
        logger.error(f"Failed to rebuild places index: {e}")

    # Rebuild hotels index
    try:
        hotels_response = db.table("hotels").select(
            "id, name, locality, property_type, amenities"
        ).execute()

        if hotels_response.data:
            hotels_index._init_empty()
            for hotel in hotels_response.data:
                vector = embed_hotel(hotel)
                hotels_index.add(hotel["id"], vector)
            hotels_index.save()
            logger.info(f"Indexed {len(hotels_response.data)} hotels")
    except Exception as e:
        logger.error(f"Failed to rebuild hotels index: {e}")

    # Rebuild blogs index
    try:
        blogs_response = db.table("blogs_and_guides").select(
            "id, key_tips, local_insights"
        ).execute()

        if blogs_response.data:
            blogs_index._init_empty()
            for blog in blogs_response.data:
                vector = embed_blog(blog)
                blogs_index.add(blog["id"], vector)
            blogs_index.save()
            logger.info(f"Indexed {len(blogs_response.data)} blogs")
    except Exception as e:
        logger.error(f"Failed to rebuild blogs index: {e}")

    logger.info("RAG index rebuild complete")

    return {
        "places": len(places_index.metadata),
        "hotels": len(hotels_index.metadata),
        "blogs": len(blogs_index.metadata),
    }