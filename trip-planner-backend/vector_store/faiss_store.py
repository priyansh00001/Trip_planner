import faiss
import numpy as np
import json, os, pickle
from vector_store.embedder import embed_trip_request

INDEX_PATH = "vector_store/trip_index.faiss"
META_PATH  = "vector_store/trip_meta.pkl"
DIM = 384  # all-MiniLM-L6-v2 output dim

class TripVectorStore:
    def __init__(self):
        if os.path.exists(INDEX_PATH):
            self.index = faiss.read_index(INDEX_PATH)
            with open(META_PATH, "rb") as f:
                self.metadata = pickle.load(f)
        else:
            self.index = faiss.IndexFlatIP(DIM)  # Inner product = cosine on normalised vecs
            self.metadata = []

    def add_trip(self, destination: str, style: str, days: int, result: dict):
        vec = embed_trip_request(destination, style, days).reshape(1, -1).astype("float32")
        self.index.add(vec)
        self.metadata.append({
            "destination": destination,
            "style": style,
            "days": days,
            "result": result
        })
        self._save()

    def search(self, destination: str, style: str, days: int, threshold: float = 0.92):
        if self.index.ntotal == 0:
            return None
        vec = embed_trip_request(destination, style, days).reshape(1, -1).astype("float32")
        scores, indices = self.index.search(vec, k=1)
        if scores[0][0] >= threshold:
            return self.metadata[indices[0][0]]["result"]
        return None

    def _save(self):
        faiss.write_index(self.index, INDEX_PATH)
        with open(META_PATH, "wb") as f:
            pickle.dump(self.metadata, f)

trip_store = TripVectorStore()  # singleton
