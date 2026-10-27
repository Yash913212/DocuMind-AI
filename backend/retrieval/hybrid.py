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
    1. Text similarity (all-mpnet-base-v2 via ChromaDB vector store)
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

    async def retrieve_document_summary(
        self,
        document_name: str,
        query: str = "",
        target_chunk_count: int = 18,
    ) -> List[Tuple[Document, float]]:
        """
        Stratified whole-document retrieval for comprehensive summarization.
        Extracts representative chunks evenly distributed across the entire document
        from page 1 to the final page, plus top semantic chunks for any specific query keywords.
        """
        from backend.config import is_private_mode
        from backend.privacy_manager import is_document_allowed_in_current_mode

        if is_private_mode() and not is_document_allowed_in_current_mode(document_name, "private"):
            logger.warning(f"Private mode active: blocked access to public document '{document_name}'")
            return []

        try:
            chunks = await asyncio.to_thread(db_manager.get_document_chunks, document_name)
            if not chunks:
                logger.warning(f"No chunks found for document: {document_name}")
                return await self._text_retrieval(query, self.text_k, {})

            # Group chunks by page
            from collections import defaultdict
            chunks_by_page = defaultdict(list)
            for c in chunks:
                page = c.get("metadata", {}).get("page", 0)
                chunks_by_page[page].append(c)

            sorted_pages = sorted(chunks_by_page.keys())
            total_pages = len(sorted_pages)

            if total_pages <= target_chunk_count:
                sample_indices = set(range(total_pages))
            else:
                step = max(1, total_pages // target_chunk_count)
                sample_indices = set(range(0, total_pages, step))
                sample_indices.add(0)  # Always include first page (title / intro)
                sample_indices.add(total_pages - 1)  # Always include last page (conclusion / epilogue)

            selected_chunks = []
            seen_ids = set()

            for idx in sorted(sample_indices):
                page = sorted_pages[idx]
                page_chunks = chunks_by_page[page]
                # Pick the chunk with the most substantial text content
                best_chunk = max(page_chunks, key=lambda x: len(x.get("content", "")))
                chunk_id = best_chunk.get("id", str(idx))
                if chunk_id not in seen_ids:
                    seen_ids.add(chunk_id)
                    selected_chunks.append(best_chunk)

            # Convert to (Document, score) format
            results = []
            for c in selected_chunks:
                meta = c.get("metadata", {}).copy()
                doc = Document(page_content=c.get("content", ""), metadata=meta)
                results.append((doc, 0.95))

            # If a specific user query was provided, also fetch top similarity chunks to enrich context
            if query and query.strip():
                try:
                    doc_path = os.path.join(os.environ.get("DATA_DIR", "./data"), document_name)
                    query_chunks = await asyncio.to_thread(
                        db_manager.similarity_search,
                        query,
                        k=3,
                        filter_dict={"source": doc_path}
                    )
                    existing_texts = {d.page_content for d, _ in results}
                    for q_doc, q_score in query_chunks:
                        if q_doc.page_content not in existing_texts:
                            results.append((q_doc, max(0.5, float(q_score))))
                except Exception as e:
                    logger.debug(f"Query enhancement in summary retrieval skipped: {e}")

            # Sort chronologically by page number so the LLM reads through the document in order
            def get_page_num(item):
                p = item[0].metadata.get("page", 0)
                return p if isinstance(p, int) else 0

            results.sort(key=get_page_num)
            logger.info(f"Retrieved {len(results)} stratified summary chunks across {total_pages} pages for {document_name}")
            return results
        except Exception as e:
            logger.error(f"Error in retrieve_document_summary: {e}", exc_info=True)
            return await self._text_retrieval(query, self.text_k, {})

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
        from backend.config import is_private_mode
        from backend.privacy_manager import is_document_allowed_in_current_mode, get_documents_for_mode

        # Privacy mode validation
        if is_private_mode():
            if document and not is_document_allowed_in_current_mode(document, "private"):
                logger.warning(f"Private mode active: blocked access to public document '{document}'")
                return []
            private_docs = get_documents_for_mode("private")
            if not private_docs:
                logger.info("Private mode active: zero private documents exist in storage.")
                return []

        # If query is asking for a summary/overview and a document is provided, use stratified whole-document retrieval
        if (query_type == "summary") and document:
            return await self.retrieve_document_summary(document, query)

        # Determine retrieval strategy based on query type
        strategy = self._get_strategy(query_type)

        # Build filter
        filter_dict = {}
        if document:
            doc_path = os.path.join(os.environ.get("DATA_DIR", "./data"), document)
            filter_dict["source"] = doc_path
        elif is_private_mode():
            # If in private mode and only 1 private doc exists, scope filter to it
            private_docs = get_documents_for_mode("private")
            if len(private_docs) == 1:
                doc_path = os.path.join(os.environ.get("DATA_DIR", "./data"), private_docs[0])
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

        if not all_candidates and not is_private_mode():
            # Fallback: simple text retrieval without filters (only allowed in public mode)
            logger.warning("No results from hybrid retrieval, falling back to simple search.")
            all_candidates = await self._text_retrieval(query, self.text_k, {})

        # Ensure strict mode isolation: purge any candidates from excluded modes
        all_candidates = [
            (doc, score) for doc, score in all_candidates
            if is_document_allowed_in_current_mode(os.path.basename(doc.metadata.get("source", "")))
        ]

        if not all_candidates:
            return []

        # Fuse and re-rank
        final_results = self._fuse_and_rerank(all_candidates, query_type)

        return final_results[:self.final_k]

    def _get_strategy(self, query_type: str) -> Dict[str, Any]:
        """Get retrieval parameters based on query type."""
        strategies = {
            "summary": {
                "text_k": 30,
                "table_k": 5,
                "visual_k": 5,
                "include_tables": True,
                "include_visual": True,
            },
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
