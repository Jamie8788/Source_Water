"""
Embeddings and RAG service.
Uses TF-IDF vectorizer (scikit-learn) — 100% free, no API key, no external calls.
Falls back to keyword overlap scoring if sklearn unavailable.
"""
import json
import pickle
import numpy as np
from pathlib import Path
from typing import List, Tuple

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity as sk_cosine
    SKLEARN_OK = True
except ImportError:
    SKLEARN_OK = False
    print("[embeddings] sklearn unavailable — using keyword fallback")

CHUNK_SIZE    = 300     # words per chunk
CHUNK_OVERLAP = 50      # overlap between chunks
TOP_K         = 5
MAX_CHARS     = 150_000  # ~100 pages max — prevents timeout on huge PDFs


def _keyword_score(query: str, chunk: str) -> float:
    """Simple word-overlap score — fallback when sklearn unavailable."""
    q = set(query.lower().split())
    c = set(chunk.lower().split())
    return len(q & c) / max(len(q), 1)


class EmbeddingService:
    def __init__(self):
        self.indexes = {}  # file_id → {chunks, vectorizer, matrix}

    # ── Chunking ──────────────────────────────────────────────────────────────
    def chunk_text(self, text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
        text = text[:MAX_CHARS]  # hard cap to prevent timeout
        words = text.split()
        chunks, i = [], 0
        while i < len(words):
            chunk = " ".join(words[i:i + size])
            if chunk.strip():
                chunks.append(chunk)
            i += size - overlap
        return chunks

    # ── Index build ───────────────────────────────────────────────────────────
    def build_index(self, file_id: str, text: str, storage_dir: Path) -> Tuple[None, List[str]]:
        chunks = self.chunk_text(text)
        if not chunks:
            self.indexes[file_id] = {"chunks": [], "vectorizer": None, "matrix": None}
            return None, []

        print(f"[embeddings] Building TF-IDF index: {len(chunks)} chunks for {file_id}")

        vectorizer = None
        matrix = None

        if SKLEARN_OK:
            try:
                vectorizer = TfidfVectorizer(
                    max_features=10_000,
                    stop_words="english",
                    ngram_range=(1, 2),   # unigrams + bigrams
                    sublinear_tf=True,
                )
                matrix = vectorizer.fit_transform(chunks)
                print(f"[embeddings] TF-IDF ready: {matrix.shape[0]} docs × {matrix.shape[1]} features")
            except Exception as e:
                print(f"[embeddings] TF-IDF build failed: {e} — falling back to keyword")
                vectorizer, matrix = None, None

        self.indexes[file_id] = {"chunks": chunks, "vectorizer": vectorizer, "matrix": matrix}

        # Persist to disk
        try:
            storage_dir.mkdir(exist_ok=True)
            with open(storage_dir / f"{file_id}.pkl", "wb") as f:
                pickle.dump({"chunks": chunks, "vectorizer": vectorizer, "matrix": matrix}, f)
            print(f"[embeddings] Index saved: {file_id}")
        except Exception as e:
            print(f"[embeddings] Save failed: {e}")

        return None, chunks

    # ── Index load ────────────────────────────────────────────────────────────
    def load_index(self, file_id: str, storage_dir: Path) -> bool:
        pkl_path = storage_dir / f"{file_id}.pkl"
        if pkl_path.exists():
            try:
                with open(pkl_path, "rb") as f:
                    self.indexes[file_id] = pickle.load(f)
                return True
            except Exception as e:
                print(f"[embeddings] Load failed {file_id}: {e}")

        # Legacy fallback: old .npy / .chunks.json format
        npy_path    = storage_dir / f"{file_id}.npy"
        chunks_path = storage_dir / f"{file_id}.chunks.json"
        if npy_path.exists() and chunks_path.exists():
            try:
                with open(chunks_path) as f:
                    chunks = json.load(f)
                self.indexes[file_id] = {"chunks": chunks, "vectorizer": None, "matrix": None}
                return True
            except Exception as e:
                print(f"[embeddings] Legacy load failed {file_id}: {e}")
        return False

    # ── Retrieval ─────────────────────────────────────────────────────────────
    def retrieve(self, file_id: str, query: str, top_k: int = TOP_K) -> List[str]:
        if file_id not in self.indexes:
            return []
        data   = self.indexes[file_id]
        chunks = data["chunks"]
        if not chunks:
            return []

        # TF-IDF cosine similarity
        if SKLEARN_OK and data.get("vectorizer") and data.get("matrix") is not None:
            try:
                q_vec = data["vectorizer"].transform([query])
                sims  = sk_cosine(q_vec, data["matrix"])[0]
                top_i = np.argsort(sims)[::-1][:top_k]
                return [chunks[i] for i in top_i]
            except Exception as e:
                print(f"[embeddings] TF-IDF retrieve error: {e}")

        # Keyword fallback
        scored = sorted((((_keyword_score(query, c), c) for c in chunks)), reverse=True)
        return [c for _, c in scored[:top_k]]

    # ── Delete ────────────────────────────────────────────────────────────────
    def delete_index(self, file_id: str, storage_dir: Path):
        self.indexes.pop(file_id, None)
        for ext in (".pkl", ".npy", ".chunks.json"):
            p = storage_dir / f"{file_id}{ext}"
            if p.exists():
                p.unlink()


embedding_service = EmbeddingService()
