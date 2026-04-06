"""
Embeddings and RAG service.
Chunks documents, generates embeddings via Gemini API, and retrieves relevant context.
Uses numpy cosine similarity instead of FAISS — no PyTorch needed.
"""
import os
import json
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional

import google.generativeai as genai

CHUNK_SIZE = 400   # words
CHUNK_OVERLAP = 60  # words
TOP_K = 5
EMBEDDING_MODEL = "models/embedding-001"


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Compute cosine similarity between vector a and matrix b."""
    a_norm = a / (np.linalg.norm(a) + 1e-10)
    b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-10)
    return b_norm @ a_norm


class EmbeddingService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
        self.indexes = {}  # file_id -> {chunks, embeddings}

    def _embed(self, texts: List[str]) -> np.ndarray:
        """Embed a list of texts using Gemini API."""
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=texts,
            task_type="retrieval_document",
        )
        return np.array(result["embedding"], dtype="float32")

    def _embed_query(self, query: str) -> np.ndarray:
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=query,
            task_type="retrieval_query",
        )
        return np.array(result["embedding"], dtype="float32")

    def chunk_text(self, text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
        words = text.split()
        chunks, i = [], 0
        while i < len(words):
            chunk = " ".join(words[i:i + size])
            if chunk.strip():
                chunks.append(chunk)
            i += size - overlap
        return chunks

    def build_index(self, file_id: str, text: str, storage_dir: Path) -> Tuple[None, List[str]]:
        chunks = self.chunk_text(text)
        if not chunks:
            raise ValueError("Could not create chunks from text")

        print(f"Embedding {len(chunks)} chunks for file {file_id}...")
        # Gemini embed_content accepts a list
        embeddings = self._embed(chunks)

        self._save_index(file_id, chunks, embeddings, storage_dir)
        self.indexes[file_id] = {"chunks": chunks, "embeddings": embeddings}
        print(f"Index built and saved: {file_id}")
        return None, chunks

    def _save_index(self, file_id: str, chunks: List[str], embeddings: np.ndarray, storage_dir: Path):
        storage_dir.mkdir(exist_ok=True)
        np.save(str(storage_dir / f"{file_id}.npy"), embeddings)
        with open(storage_dir / f"{file_id}.chunks.json", "w") as f:
            json.dump(chunks, f)

    def load_index(self, file_id: str, storage_dir: Path) -> bool:
        npy_path = storage_dir / f"{file_id}.npy"
        chunks_path = storage_dir / f"{file_id}.chunks.json"
        if not npy_path.exists() or not chunks_path.exists():
            return False
        try:
            embeddings = np.load(str(npy_path))
            with open(chunks_path, "r") as f:
                chunks = json.load(f)
            self.indexes[file_id] = {"chunks": chunks, "embeddings": embeddings}
            return True
        except Exception as e:
            print(f"Error loading index {file_id}: {e}")
            return False

    def retrieve(self, file_id: str, query: str, top_k: int = TOP_K) -> List[str]:
        if file_id not in self.indexes:
            return []
        q_emb = self._embed_query(query)
        data = self.indexes[file_id]
        sims = _cosine_similarity(q_emb, data["embeddings"])
        top_indices = np.argsort(sims)[::-1][:top_k]
        return [data["chunks"][i] for i in top_indices]

    def delete_index(self, file_id: str, storage_dir: Path):
        if file_id in self.indexes:
            del self.indexes[file_id]
        for ext in (".npy", ".chunks.json", ".faiss"):
            p = storage_dir / f"{file_id}{ext}"
            if p.exists():
                p.unlink()


embedding_service = EmbeddingService()
