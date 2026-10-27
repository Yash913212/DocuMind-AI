"""
Cross-Encoder Reranking Module for DocuMind AI.

Implements deep semantic cross-attention scoring using transformer Cross-Encoders
(e.g., BAAI/bge-reranker-base) on the top retrieved candidate pool prior to prompt synthesis.
"""

import logging
import math
from typing import List, Optional, Tuple
from langchain_core.documents import Document

from backend.config import (
    ENABLE_CROSS_ENCODER,
    CROSS_ENCODER_MODEL,
    CROSS_ENCODER_TOP_N,
)

logger = logging.getLogger(__name__)


def _sigmoid(x: float) -> float:
    """Stable sigmoid function to map logits to (0, 1) probability range."""
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    else:
        z = math.exp(x)
        return z / (1.0 + z)


class CrossEncoderReranker:
    """
    Reranks dense/sparse/hybrid retrieved candidates using a fine-grained Cross-Encoder.
    Cross-encoders process (query, document) jointly through all transformer layers,
    calculating direct token-to-token cross-attention to eliminate false-positive semantic matches.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        top_n: Optional[int] = None,
        enabled: Optional[bool] = None,
    ):
        self.model_name = model_name or CROSS_ENCODER_MODEL
        self.top_n = top_n or CROSS_ENCODER_TOP_N
        self.enabled = ENABLE_CROSS_ENCODER if enabled is None else enabled
        self._model = None
        self._load_attempted = False

    def _get_model(self):
        """Lazy loader for the CrossEncoder to avoid overhead during app initialization."""
        if self._model is not None:
            return self._model
        if self._load_attempted:
            return None

        self._load_attempted = True
        try:
            from sentence_transformers import CrossEncoder

            logger.info(f"Loading Cross-Encoder model '{self.model_name}' on CPU...")
            self._model = CrossEncoder(self.model_name, device="cpu")
            logger.info(f"Cross-Encoder model '{self.model_name}' loaded successfully.")
            return self._model
        except Exception as e:
            logger.warning(
                f"Cross-Encoder initialization failed for '{self.model_name}': {e}. "
                "Retrieval will gracefully fall back to hybrid candidate fusion."
            )
            return None

    def rerank(
        self,
        query: str,
        candidates: List[Tuple[Document, float]],
        top_n: Optional[int] = None,
    ) -> List[Tuple[Document, float]]:
        """
        Rerank the candidate documents.
        
        Args:
            query: The user search or question string.
            candidates: List of (Document, initial_score) tuples from hybrid retrieval.
            top_n: Maximum number of candidates to pass to the cross-encoder.
            
        Returns:
            Re-ranked list of (Document, score) tuples.
        """
        if not self.enabled or not candidates or not query:
            return candidates

        model = self._get_model()
        if model is None:
            return candidates

        n = top_n or self.top_n
        pool = candidates[:n]
        remainder = candidates[n:]

        try:
            # Construct (query, text) pairs for joint cross-attention
            pairs = []
            for doc, _ in pool:
                # Use document text snippet, capped to 1500 chars to prevent OOM
                snippet = doc.page_content[:1500].strip()
                pairs.append([query, snippet])

            raw_scores = model.predict(pairs, batch_size=16)

            scored_pool = []
            for idx, (doc, _) in enumerate(pool):
                raw_score = float(raw_scores[idx])
                # Convert logit to normalized confidence score in [0.0, 1.0]
                norm_score = round(_sigmoid(raw_score), 4)

                # Annotate document metadata for full auditability
                updated_meta = dict(doc.metadata) if doc.metadata else {}
                updated_meta["cross_encoder_score"] = norm_score
                updated_meta["cross_encoder_raw"] = round(raw_score, 4)
                updated_meta["rerank_model"] = self.model_name

                # Create new document instance with updated metadata
                annotated_doc = Document(
                    page_content=doc.page_content,
                    metadata=updated_meta,
                )
                scored_pool.append((annotated_doc, norm_score))

            # Sort candidate pool descending by cross-encoder score
            scored_pool.sort(key=lambda x: x[1], reverse=True)

            logger.info(
                f"Cross-Encoder reranked {len(scored_pool)} candidates using '{self.model_name}'. "
                f"Top score: {scored_pool[0][1]:.4f} (was {pool[0][1]:.4f})"
            )
            return scored_pool + remainder

        except Exception as e:
            logger.error(f"Cross-encoder reranking encountered error: {e}. Preserving candidate order.")
            return candidates


# Singleton module instance
reranker = CrossEncoderReranker()
