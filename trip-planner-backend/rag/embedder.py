# IMPLEMENTATION NOTE:
# RAG embedder for destination content (places, hotels, blogs).
# Reuses the already-loaded SentenceTransformer instance from vector_store/embedder.py
# to avoid loading the model twice in memory.

import numpy as np
from vector_store.embedder import model  # Reuse existing model instance


def embed_place(place: dict) -> np.ndarray:
    """Embed a place record for retrieval."""
    tags = " ".join(place.get("tags") or [])
    text = f"{place.get('name', '')} {place.get('category', '')} {place.get('description', '')} {tags}"
    return model.encode(text, normalize_embeddings=True).astype("float32")


def embed_hotel(hotel: dict) -> np.ndarray:
    """Embed a hotel record for retrieval."""
    amenities = " ".join(hotel.get("amenities") or [])
    text = f"{hotel.get('name', '')} {hotel.get('locality', '')} {hotel.get('property_type', '')} {amenities}"
    return model.encode(text, normalize_embeddings=True).astype("float32")


def embed_blog(blog: dict) -> np.ndarray:
    """Embed a blog post for retrieval."""
    tips = " ".join(blog.get("key_tips") or [])
    insights = " ".join(blog.get("local_insights") or [])
    text = f"{tips} {insights}"
    return model.encode(text, normalize_embeddings=True).astype("float32")


def embed_query(destination: str, preferences: str, budget_tier: str) -> np.ndarray:
    """Embed a user query for retrieval."""
    text = f"{destination} {preferences} {budget_tier}"
    return model.encode(text, normalize_embeddings=True).astype("float32")