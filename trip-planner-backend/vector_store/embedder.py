from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("all-MiniLM-L6-v2")  # 22MB, runs on CPU fine

def embed_trip_request(destination: str, style: str, days: int) -> np.ndarray:
    text = f"{destination} {style} {days} days"
    return model.encode(text, normalize_embeddings=True)

def embed_text(text: str) -> np.ndarray:
    return model.encode(text, normalize_embeddings=True)
