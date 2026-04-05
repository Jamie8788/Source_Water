"""
Embeddings and RAG service.
Chunks documents, generates embeddings, indexes with FAISS, and retrieves relevant context.
"""
import json
from pathlib import Path
from typing import List, Tuple, Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


CHUNK_SIZE = 400  # words
CHUNK_OVERLAP = 60  # words
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
TOP_K = 5  # retrieve top-k chunks


class EmbeddingService:
    def __init__(self):
        print(f"Loading embedding model: {EMBEDDING_MODEL}")
        self.model = SentenceTransformer(EMBEDDING_MODEL)
        self.indexes = {}  # file_id -> {index, chunks, embeddings}
    
    def chunk_text(self, text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
        """Split text into overlapping chunks."""
        words = text.split()
        chunks = []
        
        i = 0
        while i < len(words):
            chunk = " ".join(words[i:i+size])
            if chunk.strip():
                chunks.append(chunk)
            i += size - overlap
        
        return chunks
    
    def build_index(self, file_id: str, text: str, storage_dir: Path) -> Tuple[faiss.Index, List[str]]:
        """
        Chunk text and build FAISS index.
        
        Returns: (index, chunks)
        """
        # Chunk
        chunks = self.chunk_text(text)
        if not chunks:
            raise ValueError("Could not create chunks from text")
        
        # Embed
        print(f"Embedding {len(chunks)} chunks for file {file_id}...")
        embeddings = self.model.encode(chunks, convert_to_numpy=True)
        embeddings = embeddings.astype('float32')
        
        # Create FAISS index
        d = embeddings.shape[1]
        index = faiss.IndexFlatL2(d)
        index.add(embeddings)
        
        # Save
        self._save_index(file_id, index, chunks, storage_dir)
        self.indexes[file_id] = {
            'index': index,
            'chunks': chunks,
            'embeddings': embeddings,
        }
        
        print(f"Index built and saved: {file_id}")
        return index, chunks
    
    def _save_index(self, file_id: str, index: faiss.Index, chunks: List[str], storage_dir: Path):
        """Save FAISS index and chunks to disk."""
        storage_dir.mkdir(exist_ok=True)
        
        faiss.write_index(
            index,
            str(storage_dir / f"{file_id}.faiss")
        )
        
        with open(storage_dir / f"{file_id}.chunks.json", 'w') as f:
            json.dump(chunks, f)
    
    def load_index(self, file_id: str, storage_dir: Path) -> bool:
        """Load FAISS index from disk."""
        idx_path = storage_dir / f"{file_id}.faiss"
        chunks_path = storage_dir / f"{file_id}.chunks.json"
        
        if not idx_path.exists() or not chunks_path.exists():
            return False
        
        try:
            index = faiss.read_index(str(idx_path))
            with open(chunks_path, 'r') as f:
                chunks = json.load(f)
            
            # Re-embed chunks to have embeddings available
            embeddings = self.model.encode(chunks, convert_to_numpy=True).astype('float32')
            
            self.indexes[file_id] = {
                'index': index,
                'chunks': chunks,
                'embeddings': embeddings,
            }
            return True
        except Exception as e:
            print(f"Error loading index {file_id}: {e}")
            return False
    
    def retrieve(self, file_id: str, query: str, top_k: int = TOP_K) -> List[str]:
        """Retrieve top-k relevant chunks for query."""
        if file_id not in self.indexes:
            return []
        
        # Embed query
        query_embedding = self.model.encode([query], convert_to_numpy=True).astype('float32')
        
        # Search
        index_data = self.indexes[file_id]
        distances, indices = index_data['index'].search(query_embedding, min(top_k, len(index_data['chunks'])))
        
        # Get chunks
        chunks = [index_data['chunks'][i] for i in indices[0]]
        
        # Filter by distance threshold
        threshold = 1.5  # euclidean distance
        filtered = []
        for i, chunk in enumerate(chunks):
            if distances[0][i] < threshold:
                filtered.append(chunk)
        
        return filtered if filtered else chunks[:top_k]
    
    def delete_index(self, file_id: str, storage_dir: Path):
        """Delete index from memory and disk."""
        if file_id in self.indexes:
            del self.indexes[file_id]
        
        idx_path = storage_dir / f"{file_id}.faiss"
        chunks_path = storage_dir / f"{file_id}.chunks.json"
        
        if idx_path.exists():
            idx_path.unlink()
        if chunks_path.exists():
            chunks_path.unlink()


embedding_service = EmbeddingService()
