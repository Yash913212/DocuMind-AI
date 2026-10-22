"""
Main document processing orchestrator.
Coordinates PDF processing, table extraction, image analysis, and chunk storage.
Handles all file types supported by the system.
"""

import asyncio
import json
import logging
import os
import re
import uuid
from typing import AsyncGenerator, Dict, List, Optional

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.config import (
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    DATA_DIR,
    ENABLE_DIAGRAM_ANALYSIS,
    ENABLE_TABLE_RETRIEVAL,
    ENABLE_VISUAL_RETRIEVAL,
)
from backend.database import db_manager
from backend.ingestion.pdf_processor import (
    process_pdf,
    table_to_text,
    figure_to_text,
)
from backend.vision import (
    describe_image,
    analyze_technical_page,
    analyze_diagram,
)

logger = logging.getLogger(__name__)


def sse(data: dict) -> str:
    """Format data as a Server-Sent Event."""
    return f"data: {json.dumps(data)}\n\n"


async def process_document(
    file_path: str,
    filename: str,
    upload_lock: asyncio.Lock,
) -> AsyncGenerator[str, None]:
    """
    Main document processing pipeline.
    Handles PDFs with page-aware multimodal processing,
    and falls back to simple processing for other file types.
    
    Yields SSE progress events.
    """
    ext = os.path.splitext(filename)[1].lower()
    document_id = str(uuid.uuid4())

    try:
        yield sse({"type": "progress", "phase": "upload", "percent": 25})

        if ext == ".pdf":
            async for event in _process_pdf_multimodal(
                file_path, filename, document_id, upload_lock
            ):
                yield event

        elif ext in [".png", ".jpg", ".jpeg", ".webp"]:
            async for event in _process_image(
                file_path, filename, document_id, upload_lock
            ):
                yield event

        else:
            async for event in _process_text_file(
                file_path, filename, ext, upload_lock
            ):
                yield event

    except Exception as exc:
        logger.error(f"Document processing error: {exc}", exc_info=True)
        yield sse({"type": "error", "message": f"Failed to process document: {str(exc)}"})


async def _process_pdf_multimodal(
    file_path: str,
    filename: str,
    document_id: str,
    upload_lock: asyncio.Lock,
) -> AsyncGenerator[str, None]:
    """
    Full multimodal PDF processing pipeline:
    1. Page-aware text extraction
    2. Table extraction and indexing
    3. Image/figure extraction
    4. Vision analysis of visual pages
    5. Chunked text embedding
    """
    yield sse({"type": "progress", "phase": "analyzing", "percent": 30})

    # ── Step 1: Page-aware extraction ──
    pdf_result = await asyncio.to_thread(process_pdf, file_path, document_id)
    pages = pdf_result["pages"]
    doc_metadata = pdf_result["metadata"]

    yield sse({
        "type": "progress",
        "phase": "extracting",
        "percent": 40,
        "detail": f"{len(pages)} pages found",
    })

    # ── Step 2: Build page-aware text chunks ──
    text_docs = []
    table_docs = []
    figure_docs = []

    for page_data in pages:
        page_num = page_data["page_number"]
        page_text = page_data["text"]
        section = page_data.get("section", "")
        subsection = page_data.get("subsection", "")

        # Create text chunks preserving page provenance
        if page_text.strip():
            base_metadata = {
                "source": file_path,
                "page": page_num,
                "chunk_type": "text",
                "document_name": filename,
                "document_id": document_id,
                "section": section or "",
                "subsection": subsection or "",
            }

            # Add warnings and specs to metadata if found
            if page_data["warnings"]:
                base_metadata["warnings"] = page_data["warnings"]
            if page_data["specifications"]:
                base_metadata["specifications"] = page_data["specifications"]
            if page_data["headings"]:
                base_metadata["headings"] = [h["text"] for h in page_data["headings"]]

            # Build enriched page text with structural context
            enriched_text = _build_enriched_page_text(page_data)
            
            text_docs.append(
                Document(page_content=enriched_text, metadata=base_metadata)
            )

        # ── Step 3: Process tables ──
        if ENABLE_TABLE_RETRIEVAL:
            for table_data in page_data["tables"]:
                tbl_text = table_to_text(table_data)
                table_metadata = {
                    "source": file_path,
                    "page": page_num,
                    "chunk_type": "table",
                    "document_name": filename,
                    "document_id": document_id,
                    "table_title": table_data.get("title", ""),
                    "table_index": table_data.get("table_index", 0),
                    "row_count": table_data.get("row_count", 0),
                    "col_count": table_data.get("col_count", 0),
                    "section": section or "",
                }
                table_docs.append(
                    Document(page_content=tbl_text, metadata=table_metadata)
                )

        # ── Step 4: Process figures ──
        for figure_data in page_data["figures"]:
            fig_text = figure_to_text(figure_data)
            figure_metadata = {
                "source": file_path,
                "page": page_num,
                "chunk_type": "figure",
                "document_name": filename,
                "document_id": document_id,
                "figure_id": figure_data.get("figure_id", ""),
                "image_path": figure_data.get("image_path", ""),
                "section": section or "",
            }
            figure_docs.append(
                Document(page_content=fig_text, metadata=figure_metadata)
            )

    yield sse({
        "type": "progress",
        "phase": "tables",
        "percent": 50,
        "detail": f"{len(table_docs)} tables, {len(figure_docs)} figures",
    })

    # ── Step 5: Vision analysis of pages with visual content ──
    if ENABLE_VISUAL_RETRIEVAL or ENABLE_DIAGRAM_ANALYSIS:
        visual_docs = await _process_visual_pages(
            pages, file_path, filename, document_id
        )
        yield sse({
            "type": "progress",
            "phase": "vision",
            "percent": 60,
            "detail": f"{len(visual_docs)} visual descriptions generated",
        })
    else:
        visual_docs = []

    # ── Step 6: Chunk text documents ──
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )
    text_splits = await asyncio.to_thread(text_splitter.split_documents, text_docs)

    # Combine all chunks
    all_docs = text_splits + table_docs + figure_docs + visual_docs

    if not all_docs:
        yield sse({"type": "error", "message": "No extractable content found in PDF."})
        return

    yield sse({
        "type": "progress",
        "phase": "embedding",
        "percent": 65,
        "detail": f"{len(all_docs)} total chunks to embed",
    })

    # ── Step 7: Batch embed and store ──
    total = len(all_docs)
    batch_size = 5
    for i in range(0, total, batch_size):
        batch = all_docs[i: i + batch_size]
        ids = [str(uuid.uuid4()) for _ in batch]
        async with upload_lock:
            await asyncio.to_thread(db_manager.add_documents, batch, ids)
        percent = 65 + int(35 * (i + len(batch)) / total)
        yield sse({
            "type": "progress",
            "phase": "embedding",
            "percent": min(percent, 99),
        })

    yield sse({
        "type": "done",
        "filename": filename,
        "chunks_added": total,
        "document_info": {
            "pages": doc_metadata["total_pages"],
            "tables": doc_metadata["total_tables"],
            "figures": doc_metadata["total_figures"],
            "images": doc_metadata["total_images"],
            "text_chunks": len(text_splits),
            "table_chunks": len(table_docs),
            "figure_chunks": len(figure_docs),
            "visual_chunks": len(visual_docs),
        },
    })


def _build_enriched_page_text(page_data: Dict) -> str:
    """
    Build enriched text for a page, including structural context
    (section headers, warnings, specs) to help retrieval quality.
    """
    parts = []

    # Add section context
    section = page_data.get("section")
    subsection = page_data.get("subsection")
    if section:
        parts.append(f"[Section: {section}]")
    if subsection:
        parts.append(f"[Subsection: {subsection}]")

    # Main text
    text = page_data.get("text", "").strip()
    if text:
        parts.append(text)

    # Add warnings inline
    for warning in page_data.get("warnings", []):
        parts.append(f"⚠️ WARNING: {warning}")

    # Add specifications inline
    for spec in page_data.get("specifications", []):
        parts.append(f"📋 SPEC: {spec}")

    return "\n".join(parts)


async def _process_visual_pages(
    pages: List[Dict],
    file_path: str,
    filename: str,
    document_id: str,
) -> List[Document]:
    """
    Process pages that have visual content (images, diagrams, schematics)
    through the vision model for semantic understanding.
    """
    visual_docs = []

    # Only process pages that have figures/images or are likely to contain diagrams
    visual_pages = [
        p for p in pages
        if (p["figures"] or p["images"] or _page_likely_has_diagram(p))
        and p.get("page_image_path")
    ]

    # Limit vision API calls to avoid rate limits
    max_visual_pages = min(len(visual_pages), 20)
    visual_pages = visual_pages[:max_visual_pages]

    for page_data in visual_pages:
        page_num = page_data["page_number"]
        page_image = page_data.get("page_image_path")

        if not page_image or not os.path.exists(page_image):
            continue

        try:
            # Use vision model to analyze the page
            if ENABLE_DIAGRAM_ANALYSIS and page_data["figures"]:
                analysis = await asyncio.to_thread(
                    analyze_diagram, page_image
                )
                description = analysis.get("description", "")
            else:
                analysis = await asyncio.to_thread(
                    analyze_technical_page, page_image
                )
                description = analysis.get("description", "")

            if description and description != "Failed to generate description.":
                visual_metadata = {
                    "source": file_path,
                    "page": page_num,
                    "chunk_type": "visual_page",
                    "document_name": filename,
                    "document_id": document_id,
                    "image_path": page_image,
                    "has_diagram": analysis.get("has_diagram", False),
                    "has_table": analysis.get("has_table", False),
                    "section": page_data.get("section", ""),
                }

                visual_docs.append(
                    Document(
                        page_content=f"[Visual Analysis - Page {page_num + 1}]\n{description}",
                        metadata=visual_metadata,
                    )
                )

        except Exception as e:
            logger.warning(f"Vision analysis failed for page {page_num}: {e}")

    return visual_docs


def _page_likely_has_diagram(page_data: Dict) -> bool:
    """Heuristic: does this page likely contain a diagram based on text patterns?"""
    text = page_data.get("text", "").lower()
    indicators = [
        "figure", "fig.", "diagram", "schematic", "circuit",
        "flowchart", "layout", "assembly", "exploded view",
    ]
    return any(ind in text for ind in indicators)


async def _process_image(
    file_path: str,
    filename: str,
    document_id: str,
    upload_lock: asyncio.Lock,
) -> AsyncGenerator[str, None]:
    """Process a standalone image file (preserves original behavior)."""
    description = await asyncio.to_thread(describe_image, file_path)

    if not description or description.startswith("Error") or description == "Failed to generate description.":
        yield sse({"type": "error", "message": "Failed to process image with vision model."})
        return

    docs = [
        Document(
            page_content=f"Image Description for {filename}:\n{description}",
            metadata={
                "source": file_path,
                "page": 0,
                "chunk_type": "image",
                "document_name": filename,
                "document_id": document_id,
            },
        )
    ]

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )
    splits = await asyncio.to_thread(text_splitter.split_documents, docs)

    total = len(splits)
    batch_size = 5
    for i in range(0, total, batch_size):
        batch = splits[i: i + batch_size]
        ids = [str(uuid.uuid4()) for _ in batch]
        async with upload_lock:
            await asyncio.to_thread(db_manager.add_documents, batch, ids)
        percent = 25 + int(75 * (i + len(batch)) / total)
        yield sse({"type": "progress", "phase": "embedding", "percent": min(percent, 100)})

    yield sse({"type": "done", "filename": filename, "chunks_added": total})


async def _process_text_file(
    file_path: str,
    filename: str,
    ext: str,
    upload_lock: asyncio.Lock,
) -> AsyncGenerator[str, None]:
    """Process text-based files (MD, TXT, CSV) — preserves original behavior."""
    if ext == ".pdf":
        from langchain_community.document_loaders import PyPDFLoader
        loader = PyPDFLoader(file_path)
    elif ext in [".md", ".txt"]:
        from langchain_community.document_loaders import TextLoader
        loader = TextLoader(file_path, encoding="utf-8")
    elif ext == ".csv":
        from langchain_community.document_loaders.csv_loader import CSVLoader
        loader = CSVLoader(file_path, encoding="utf-8")
    else:
        from langchain_community.document_loaders import TextLoader
        loader = TextLoader(file_path, encoding="utf-8")

    docs = await asyncio.to_thread(loader.load)

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )
    splits = await asyncio.to_thread(text_splitter.split_documents, docs)

    if not splits:
        yield sse({"type": "error", "message": "No extractable text found."})
        return

    total = len(splits)
    batch_size = 5
    for i in range(0, total, batch_size):
        batch = splits[i: i + batch_size]
        ids = [str(uuid.uuid4()) for _ in batch]
        async with upload_lock:
            await asyncio.to_thread(db_manager.add_documents, batch, ids)
        percent = 25 + int(75 * (i + len(batch)) / total)
        yield sse({"type": "progress", "phase": "embedding", "percent": min(percent, 100)})

    yield sse({"type": "done", "filename": filename, "chunks_added": total})
