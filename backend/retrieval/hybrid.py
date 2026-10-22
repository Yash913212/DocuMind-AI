"""
Hybrid retrieval system combining text, table, visual, and metadata-based search.
Implements candidate fusion, deduplication, and re-ranking.
"""

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.documents import Document

from backend.config import RETRIEVAL_K, RERANK_TOP_K, ENABLE_VISUAL_RETRIEVAL, ENABLE_TABLE_RETRIEVAL
from backend.database import db_manager

logger = logging.getLogger(__name__)


class HybridRetriever:
    """
    Combines multiple retrieval strategies:
    1. Text similarity (all-mpnet-base-v2 via Supabase pgvector)
    2. Table-specific retrieval (filtered by chunk_type)
    3. Visual page retrieval (filtered by chunk_type)
    4. Metadata filtering (document, page, section)
    
    Then fuses, deduplicates, and re-ranks results.
    """

    def __init__(self):
        self.text_k = RETRIEVAL_K
        self.visual_k = max(3, RETRIEVAL_K // 2)
        self.table_k = max(3, RETRIEVAL_K // 2)
        self.final_k = RERANK_TOP_K

    async def retrieve(
        self,
        query: str,
        document: Optional[str] = None,
        query_type: str = "factual",
        technical_mode: bool = False,
    ) -> List[Tuple[Document, float]]:
        """
        Main hybrid retrieval entry point.
        
        Returns a ranked list of (Document, score) tuples.
        """
        # Determine retrieval strategy based on query type
        strategy = self._get_strategy(query_type)

        # Build filter
        filter_dict = {}
        if document:
            doc_path = os.path.join(os.environ.get("DATA_DIR", "./data"), document)
            filter_dict["source"] = doc_path

        # Run retrieval in parallel
        tasks = []

        # Always do text retrieval
        tasks.append(self._text_retrieval(query, strategy["text_k"], filter_dict))

        # Table retrieval for table-related queries
        if ENABLE_TABLE_RETRIEVAL and strategy["include_tables"]:
            tasks.append(self._table_retrieval(query, strategy["table_k"], filter_dict))

        # Visual retrieval for visual queries
        if ENABLE_VISUAL_RETRIEVAL and strategy["include_visual"]:
            tasks.append(self._visual_retrieval(query, strategy["visual_k"], filter_dict))

        results_lists = await asyncio.gather(*tasks, return_exceptions=True)

        # Collect all candidates
        all_candidates = []
        for result in results_lists:
            if isinstance(result, Exception):
                logger.warning(f"Retrieval sub-task failed: {result}")
                continue
            all_candidates.extend(result)

        if not all_candidates:
            # Fallback: simple text retrieval without filters
            logger.warning("No results from hybrid retrieval, falling back to simple search.")
            all_candidates = await self._text_retrieval(query, self.text_k, {})

        # Fuse and re-rank
        final_results = self._fuse_and_rerank(all_candidates, query_type)

        return final_results[:self.final_k]

    def _get_strategy(self, query_type: str) -> Dict[str, Any]:
        """Get retrieval parameters based on query type."""
        strategies = {
            "factual": {
                "text_k": self.text_k,
                "table_k": 3,
                "visual_k": 2,
                "include_tables": True,
                "include_visual": False,
            },
            "procedural": {
                "text_k": self.text_k + 2,
                "table_k": 2,
                "visual_k": 2,
                "include_tables": True,
                "include_visual": True,
            },
            "specification": {
                "text_k": self.text_k,
                "table_k": 5,
                "visual_k": 2,
                "include_tables": True,
                "include_visual": False,
            },
            "table_lookup": {
                "text_k": 3,
                "table_k": 7,
                "visual_k": 0,
                "include_tables": True,
                "include_visual": False,
            },
            "diagram_lookup": {
                "text_k": 3,
                "table_k": 2,
                "visual_k": 7,
                "include_tables": False,
                "include_visual": True,
            },
            "component_id": {
                "text_k": 4,
                "table_k": 3,
                "visual_k": 5,
                "include_tables": True,
                "include_visual": True,
            },
            "comparison": {
                "text_k": 4,
                "table_k": 5,
                "visual_k": 2,
                "include_tables": True,
                "include_visual": False,
            },
            "troubleshooting": {
                "text_k": self.text_k + 2,
                "table_k": 3,
                "visual_k": 3,
                "include_tables": True,
                "include_visual": True,
            },
            "cross_page": {
                "text_k": self.text_k + 3,
                "table_k": 3,
                "visual_k": 3,
                "include_tables": True,
                "include_visual": True,
            },
            "multimodal": {
                "text_k": 4,
                "table_k": 4,
                "visual_k": 5,
                "include_tables": True,
                "include_visual": True,
            },
        }
        return strategies.get(query_type, strategies["factual"])

    async def _text_retrieval(
        self, query: str, k: int, filter_dict: Dict
    ) -> List[Tuple[Document, float]]:
        """Standard text embedding similarity search."""
        try:
            results = await asyncio.to_thread(
                db_manager.similarity_search, query, k=k, filter_dict=filter_dict if filter_dict else None
            )
            return results
        except Exception as e:
            logger.error(f"Text retrieval failed: {e}")
            return []

    async def _table_retrieval(
        self, query: str, k: int, filter_dict: Dict
    ) -> List[Tuple[Document, float]]:
        """
        Table-specific retrieval. Uses text search but with a query
        modified to better match table content patterns.
        """
        try:
            # Enhance query for table matching
            table_query = f"table data specifications values {query}"
            results = await asyncio.to_thread(
                db_manager.similarity_search, table_query, k=k + 3, filter_dict=filter_dict if filter_dict else None
            )
            # Filter to prefer table chunks
            table_results = []
            other_results = []
            for doc, score in results:
                chunk_type = doc.metadata.get("chunk_type", "text")
                if chunk_type == "table":
                    table_results.append((doc, score * 1.1))  # Slight boost for exact table matches
                else:
                    other_results.append((doc, score))

            # Return table results first, then others up to k
            combined = table_results + other_results
            return combined[:k]
        except Exception as e:
            logger.error(f"Table retrieval failed: {e}")
            return []

    async def _visual_retrieval(
        self, query: str, k: int, filter_dict: Dict
    ) -> List[Tuple[Document, float]]:
        """
        Visual page retrieval. Searches for visual_page and figure chunks
        with query enhancement for visual content.
        """
        try:
            visual_query = f"diagram figure schematic image visual {query}"
            results = await asyncio.to_thread(
                db_manager.similarity_search, visual_query, k=k + 3, filter_dict=filter_dict if filter_dict else None
            )
            # Filter to prefer visual chunks
            visual_results = []
            other_results = []
            for doc, score in results:
                chunk_type = doc.metadata.get("chunk_type", "text")
                if chunk_type in ("visual_page", "figure", "diagram", "image"):
                    visual_results.append((doc, score * 1.1))
                else:
                    other_results.append((doc, score))

            combined = visual_results + other_results
            return combined[:k]
        except Exception as e:
            logger.error(f"Visual retrieval failed: {e}")
            return []

    def _fuse_and_rerank(
        self,
        candidates: List[Tuple[Document, float]],
        query_type: str,
    ) -> List[Tuple[Document, float]]:
        """
        Fuse candidates from multiple retrievers, deduplicate,
        and re-rank based on relevance and diversity.
        """
        if not candidates:
            return []

        # Deduplicate by content hash
        seen_content = set()
        unique_candidates = []
        for doc, score in candidates:
            content_key = doc.page_content[:200]  # Use first 200 chars as dedup key
            if content_key not in seen_content:
                seen_content.add(content_key)
                unique_candidates.append((doc, score))

        # Apply type-based score boost based on query type
        type_boosts = self._get_type_boosts(query_type)

        reranked = []
        for doc, score in unique_candidates:
            chunk_type = doc.metadata.get("chunk_type", "text")
            boost = type_boosts.get(chunk_type, 1.0)
            reranked.append((doc, score * boost))

        # Sort by adjusted score (higher is better)
        reranked.sort(key=lambda x: x[1], reverse=True)

        # Ensure page diversity — don't return too many chunks from the same page
        diversified = self._ensure_page_diversity(reranked)

        return diversified

    def _get_type_boosts(self, query_type: str) -> Dict[str, float]:
        """Get score multipliers for chunk types based on query type."""
        boosts = {
            "table_lookup": {"table": 1.3, "text": 0.9, "figure": 0.8, "visual_page": 0.8},
            "diagram_lookup": {"figure": 1.3, "visual_page": 1.2, "text": 0.9, "table": 0.8},
            "specification": {"table": 1.2, "text": 1.0, "figure": 0.9, "visual_page": 0.9},
            "component_id": {"figure": 1.2, "visual_page": 1.1, "table": 1.1, "text": 0.9},
            "multimodal": {"visual_page": 1.1, "figure": 1.1, "table": 1.1, "text": 1.0},
        }
        return boosts.get(query_type, {"text": 1.0, "table": 1.0, "figure": 1.0, "visual_page": 1.0})

    def _ensure_page_diversity(
        self,
        candidates: List[Tuple[Document, float]],
        max_per_page: int = 3,
    ) -> List[Tuple[Document, float]]:
        """Ensure we don't return too many chunks from the same page."""
        page_counts = {}
        diversified = []

        for doc, score in candidates:
            page_key = (
                doc.metadata.get("source", ""),
                doc.metadata.get("page", -1),
            )
            count = page_counts.get(page_key, 0)
            if count < max_per_page:
                diversified.append((doc, score))
                page_counts[page_key] = count + 1

        return diversified


# Module-level singleton
hybrid_retriever = HybridRetriever()
