"""
Multimodal RAG API — FastAPI application.

Preserves all original endpoints and adds new multimodal capabilities:
- Page-aware PDF processing with table/figure extraction
- Hybrid retrieval (text + table + visual)
- Technical manual mode with structured citations
- Enhanced document library with processing metadata

Original endpoints preserved:
  POST /chat, POST /upload, GET /documents, DELETE /documents/{name},
  GET /files/{name}, GET /search, POST /quiz, GET /map,
  POST /clear, GET /health
"""

import asyncio
import datetime
import json
import logging
import os
import re
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from duckduckgo_search import DDGS
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from langchain_core.documents import Document

from backend.config import (
    CORS_ORIGINS,
    DATA_DIR,
    MAX_UPLOAD_MB,
    RETRIEVAL_K,
    ENABLE_TECHNICAL_MODE,
    PAGE_IMAGES_DIR,
    get_privacy_mode,
    set_privacy_mode,
    is_private_mode,
)
from backend.database import db_manager
from backend.llm import (
    create_qa_chain,
    create_llm_instance,
    classify_query_type,
    format_context_for_technical_prompt,
)
from backend.models import (
    ChatRequest,
    ChatMessage,
    QuizRequest,
    TechnicalQueryRequest,
    ModeRequest,
    CompareRequest,
    CompareResult,
    NLPAnalyzeRequest,
    NLPAnalyzeResponse,
)
from backend.ingestion.processor import process_document, sse
from backend.retrieval.hybrid import hybrid_retriever
from backend.comparison import compare_documents
from backend.knowledge_graph import generate_knowledge_graph, clear_knowledge_graph_cache
from backend.nlp import analyze_nlp_query

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Global State ──
qa_chain = None
qa_chain_technical = None
llm_instance = None
upload_lock = asyncio.Lock()


def init_rag_pipeline():
    """Initialize RAG pipeline components."""
    global qa_chain, qa_chain_technical, llm_instance
    logger.info("Initializing RAG pipeline...")

    # Initialize database
    db_manager.initialize()

    # Create LLM chains
    qa_chain, llm_instance = create_qa_chain(technical_mode=False)
    qa_chain_technical, _ = create_qa_chain(technical_mode=True)

    logger.info("RAG pipeline initialized.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await asyncio.to_thread(init_rag_pipeline)
    except Exception as exc:
        logger.error(f"RAG pipeline not ready at startup: {exc}")
    yield


app = FastAPI(
    title="Multimodal RAG for Technical Manuals",
    description="A multimodal retrieval-augmented generation system for complex technical documentation.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Utility Functions ──

def secure_filename(name: str) -> str:
    name = os.path.basename(name.replace("\\", "/"))
    name = re.sub(r"[^\w\-. ]", "_", name)
    return name.strip() or "upload.pdf"


async def ensure_rag_ready():
    global qa_chain
    if qa_chain is None:
        try:
            await asyncio.to_thread(init_rag_pipeline)
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"RAG pipeline unavailable. {exc}",
            )


# ═══════════════════════════════════════════════════════════════
# EXISTING ENDPOINTS (preserved with enhancements)
# ═══════════════════════════════════════════════════════════════


@app.get("/health")
async def health():
    from backend.llm import _is_ollama_available
    return {
        "status": "ok" if qa_chain is not None else "degraded",
        "rag_initialized": qa_chain is not None,
        "technical_mode_available": ENABLE_TECHNICAL_MODE,
        "ollama_available": _is_ollama_available(),
        "privacy_mode": get_privacy_mode(),
        "version": "2.0.0",
    }


@app.post("/clear")
async def clear_db():
    await ensure_rag_ready()
    try:
        db_manager.clear_all()

        for filename in os.listdir(DATA_DIR):
            file_path = os.path.join(DATA_DIR, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)

        # Clean page images and extracted images
        for subdir in [PAGE_IMAGES_DIR, os.path.join(DATA_DIR, "extracted_images")]:
            if os.path.isdir(subdir):
                for f in os.listdir(subdir):
                    fp = os.path.join(subdir, f)
                    if os.path.isfile(fp):
                        os.remove(fp)

        clear_knowledge_graph_cache()
        return {"status": "cleared"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint with optional technical mode.
    When technical_mode=True, uses hybrid retrieval and technical prompts.
    """
    global qa_chain, qa_chain_technical, llm_instance
    await ensure_rag_ready()

    # Determine which chain to use
    use_technical = request.technical_mode or ENABLE_TECHNICAL_MODE
    chain = qa_chain_technical if use_technical else qa_chain

    # ── Step 1: Query Classification (for technical mode) ──
    query_type = "factual"
    if use_technical:
        try:
            query_type = await asyncio.to_thread(
                classify_query_type, request.query, llm_instance
            )
            logger.info(f"Query classified as: {query_type}")
        except Exception as e:
            logger.warning(f"Query classification failed: {e}")

    # ── Step 2: Hybrid Retrieval ──
    if use_technical:
        docs_with_scores = await hybrid_retriever.retrieve(
            query=request.query,
            document=request.document,
            query_type=query_type,
            technical_mode=True,
        )
    else:
        # Original retrieval path
        search_kwargs = {"k": RETRIEVAL_K}
        if request.document:
            doc_path = os.path.join(DATA_DIR, secure_filename(request.document))
            search_kwargs["filter"] = {"source": doc_path}

        docs_with_scores = await asyncio.to_thread(
            db_manager.similarity_search,
            request.query,
            **search_kwargs,
        )

    # ── Step 3: Web search augmentation (disabled in private mode) ──
    async def fetch_web_search():
        if is_private_mode():
            logger.info("Private mode enabled: skipping external web search.")
            return []
        def _search():
            try:
                results = DDGS().text(request.query, max_results=3)
                docs = []
                for r in results:
                    docs.append(
                        Document(
                            page_content=r.get("body", ""),
                            metadata={"source": f"Web: {r.get('title')}", "page": -1},
                        )
                    )
                return docs
            except Exception as e:
                logger.warning(f"Web search error: {e}")
                return []
        return await asyncio.to_thread(_search)

    web_docs = await fetch_web_search()

    # Build context documents
    context_docs = [doc for doc, _score in docs_with_scores]
    context_docs.extend(web_docs)

    score_map = {doc.page_content: score for doc, score in docs_with_scores}
    for w_doc in web_docs:
        # Web results have no vector relevance score; do not invent one.
        score_map[w_doc.page_content] = 0.0

    # ── Step 4: Build source metadata ──
    sources = []
    for idx, doc in enumerate(context_docs):
        source_metadata = doc.metadata
        page = source_metadata.get("page", 0)
        source_name = source_metadata.get("source", "Unknown")
        filename_src = os.path.basename(source_name)
        chunk_type = source_metadata.get("chunk_type", "text")

        # Enhanced page string with type info
        if page >= 0 if isinstance(page, int) else False:
            page_str = f"Page {page + 1} ({filename_src})"
        else:
            page_str = source_name

        raw_score = score_map.get(doc.page_content, 0.0)
        confidence = max(0.0, min(1.0, float(raw_score)))

        source_entry = {
            "id": idx + 1,
            "text": doc.page_content[:500],  # Limit preview
            "page": page_str,
            "score": confidence,
            "chunk_type": chunk_type,
            "page_number": page + 1 if isinstance(page, int) and page >= 0 else None,
            "document": filename_src,
        }

        # Add type-specific metadata
        if chunk_type == "table":
            source_entry["table_title"] = source_metadata.get("table_title", "")
        elif chunk_type in ("figure", "visual_page"):
            source_entry["figure_id"] = source_metadata.get("figure_id", "")
            source_entry["image_path"] = source_metadata.get("image_path", "")
            source_entry["has_diagram"] = source_metadata.get("has_diagram", False)
        
        if source_metadata.get("section"):
            source_entry["section"] = source_metadata["section"]

        sources.append(source_entry)

    # ── Step 5: Format context for technical prompt ──
    if use_technical:
        formatted_context = format_context_for_technical_prompt(
            [(doc, score) for doc, score in docs_with_scores]
        )
        # Replace context_docs with a single doc containing formatted context
        formatted_doc = Document(page_content=formatted_context, metadata={})
        chain_context = [formatted_doc]
    else:
        chain_context = context_docs

    # ── Step 6: Stream LLM response ──
    async def generate_sse():
        yield sse({
            "type": "sources",
            "sources": sources,
            "query_type": query_type if use_technical else None,
        })

        history_tuples = []
        if request.history:
            for msg in request.history:
                history_tuples.append((msg.role, msg.content))

        full_answer = ""
        try:
            async for chunk in chain.astream(
                {"input": request.query, "context": chain_context, "history": history_tuples}
            ):
                full_answer += chunk
                yield sse({"type": "content", "token": chunk})
        except Exception as llm_err:
            logger.error(f"LLM streaming error: {llm_err}", exc_info=True)
            error_msg = (
                "\n\n⚠️ **LLM Connection Error**: Could not reach the language model. "
            )
            if is_private_mode():
                error_msg += (
                    "Private mode is enabled but the local Ollama server is not running. "
                    "Please **start Ollama** (`ollama serve`) or switch back to Normal mode."
                )
            else:
                error_msg += (
                    "Neither local Ollama nor cloud fallback models responded. "
                    "Please check your API keys and network connection."
                )
            yield sse({"type": "content", "token": error_msg})
            yield sse({"type": "end", "suggestions": [
                "Switch to Normal mode",
                "How do I start Ollama?",
                "Check system status",
            ]})
            return

        # Generate follow-up suggestions
        try:
            suggestion_prompt = (
                f"Based on the following conversation and answer, suggest 3 short follow-up questions the user could ask. "
                f"Return ONLY a JSON array of strings.\n\nAnswer: {full_answer}\n\nQuestions:"
            )
            sug_result = await asyncio.to_thread(llm_instance.invoke, suggestion_prompt)
            sug_text = sug_result.content if hasattr(sug_result, "content") else str(sug_result)
            match = re.search(r"\[.*\]", sug_text, re.DOTALL)
            suggestions = (
                json.loads(match.group(0))
                if match
                else ["Can you elaborate?", "What are the key takeaways?", "Tell me more."]
            )
        except Exception:
            suggestions = ["Can you elaborate?", "What are the key takeaways?", "Tell me more."]

        yield sse({"type": "end", "suggestions": suggestions})

    return StreamingResponse(generate_sse(), media_type="text/event-stream")


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process a document with multimodal extraction."""
    await ensure_rag_ready()

    filename = secure_filename(file.filename or "")
    ext = os.path.splitext(filename)[1].lower()

    if ext not in [".pdf", ".md", ".txt", ".csv", ".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Unsupported file format.")

    file_path = os.path.join(DATA_DIR, filename)

    async def upload_stream():
        size = 0
        try:
            # Save file
            with open(file_path, "wb") as buffer:
                while True:
                    chunk = await file.read(1 << 20)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_UPLOAD_MB * 1024 * 1024:
                        raise HTTPException(
                            status_code=413,
                            detail=f"File exceeds {MAX_UPLOAD_MB}MB limit.",
                        )
                    buffer.write(chunk)

            # Process document through multimodal pipeline
            async for event in process_document(file_path, filename, upload_lock):
                yield event

        except HTTPException as exc:
            if os.path.exists(file_path):
                os.remove(file_path)
            yield sse({"type": "error", "message": str(exc.detail)})
        except Exception as exc:
            logger.error(f"Upload error: {exc}", exc_info=True)
            if os.path.exists(file_path):
                os.remove(file_path)
            yield sse({"type": "error", "message": "Failed to process document."})

    return StreamingResponse(upload_stream(), media_type="text/event-stream")


@app.get("/documents")
async def list_documents():
    """List documents with enhanced multimodal metadata."""
    await ensure_rag_ready()
    metadatas = db_manager.get_all_documents_metadata()

    docs = {}
    for meta in metadatas:
        if not meta:
            continue
        source = meta.get("source")
        if not source:
            continue

        name = os.path.basename(source)
        if name not in docs:
            docs[name] = {
                "name": name,
                "chunks": 0,
                "pages": set(),
                "size": 0,
                "type": "unknown",
                "uploaded_at": None,
                "source": source,
                "tables": 0,
                "figures": 0,
                "images": 0,
                "visual_pages": 0,
                "text_indexed": False,
                "tables_indexed": False,
                "visual_indexed": False,
                "multimodal_ready": False,
                "chunk_types": set(),
            }

        docs[name]["chunks"] += 1
        page = meta.get("page")
        if page is not None:
            docs[name]["pages"].add(page)

        chunk_type = meta.get("chunk_type", "text")
        docs[name]["chunk_types"].add(chunk_type)

        if chunk_type == "table":
            docs[name]["tables"] += 1
        elif chunk_type == "figure":
            docs[name]["figures"] += 1
        elif chunk_type == "image":
            docs[name]["images"] += 1
        elif chunk_type == "visual_page":
            docs[name]["visual_pages"] += 1

    # Enrich with file stats and processing status
    for name, info in docs.items():
        info["pages"] = len(info["pages"])
        info["text_indexed"] = "text" in info["chunk_types"]
        info["tables_indexed"] = "table" in info["chunk_types"]
        info["visual_indexed"] = "visual_page" in info["chunk_types"] or "figure" in info["chunk_types"]
        info["multimodal_ready"] = info["text_indexed"] and (info["tables_indexed"] or info["visual_indexed"])
        info["chunk_types"] = list(info["chunk_types"])  # Convert set to list for JSON

        file_path = os.path.join(DATA_DIR, name)
        if os.path.exists(file_path):
            stat = os.stat(file_path)
            info["size"] = stat.st_size
            info["uploaded_at"] = datetime.datetime.fromtimestamp(
                stat.st_mtime
            ).isoformat()
            info["type"] = os.path.splitext(name)[1].lower()

    return list(docs.values())


@app.delete("/documents/{name}")
async def delete_document(name: str):
    await ensure_rag_ready()
    safe_name = secure_filename(name)
    file_path = os.path.join(DATA_DIR, safe_name)

    # Delete from database
    deleted = db_manager.delete_document(name)

    # Delete file
    if os.path.exists(file_path):
        os.remove(file_path)

    # Clean up page images and extracted images
    for subdir in [PAGE_IMAGES_DIR, os.path.join(DATA_DIR, "extracted_images")]:
        if os.path.isdir(subdir):
            safe = re.sub(r'[^\w\-.]', '_', name)
            for f in os.listdir(subdir):
                if f.startswith(safe):
                    fp = os.path.join(subdir, f)
                    if os.path.isfile(fp):
                        os.remove(fp)

    clear_knowledge_graph_cache()
    return {"status": "success", "deleted": name, "chunks_deleted": deleted}


@app.get("/files/{name}")
async def get_file(name: str):
    file_path = os.path.join(DATA_DIR, secure_filename(name))
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@app.get("/search")
async def search_documents(q: str):
    await ensure_rag_ready()
    docs_with_scores = await asyncio.to_thread(
        db_manager.similarity_search, q, k=5
    )
    results = []
    for doc, score in docs_with_scores:
        meta = doc.metadata
        results.append({
            "text": doc.page_content,
            "source": os.path.basename(meta.get("source", "")),
            "page": meta.get("page", 0) + 1 if isinstance(meta.get("page"), int) else 0,
            "score": max(0.0, min(1.0, score)),
            "chunk_type": meta.get("chunk_type", "text"),
        })
    return results


@app.post("/quiz")
async def generate_quiz(request: QuizRequest):
    await ensure_rag_ready()
    chunks = db_manager.get_document_chunks(request.document)

    if not chunks:
        raise HTTPException(status_code=404, detail="Document chunks not found")

    import random
    content_list = [c.get("content", "") for c in chunks if c.get("content")]
    selected_chunks = random.sample(content_list, min(len(content_list), 10))
    context_str = "\n---\n".join(selected_chunks)

    if request.kind == "quiz":
        prompt = (
            f"Based on the following document context, generate a multiple-choice quiz with {request.count} questions. "
            f"Return ONLY a JSON array of objects. Each object must have 'question', 'options' (array of 4 strings), "
            f"'answer' (exact match to one option), 'explanation', and 'source' (brief excerpt). "
            f"Do not include markdown formatting like ```json.\n\nContext:\n{context_str}"
        )
    else:
        prompt = (
            f"Based on the following document context, generate {request.count} flashcards. "
            f"Return ONLY a JSON array of objects. Each object must have 'front' (concept or question), "
            f"'back' (definition or answer), and 'source' (brief excerpt). "
            f"Do not include markdown formatting like ```json.\n\nContext:\n{context_str}"
        )

    try:
        result_obj = await asyncio.to_thread(llm_instance.invoke, prompt)
    except Exception as llm_err:
        logger.error(f"Quiz LLM error: {llm_err}", exc_info=True)
        detail = "Could not reach the language model to generate the quiz."
        if is_private_mode():
            detail += " Private mode is on but Ollama is not running. Start Ollama or switch to Normal mode."
        raise HTTPException(status_code=503, detail=detail)
    result = result_obj.content if hasattr(result_obj, "content") else str(result_obj)

    try:
        clean_res = result.strip()
        if clean_res.startswith("```"):
            clean_res = re.sub(r"^```(?:json)?\s*", "", clean_res)
            clean_res = re.sub(r"\s*```$", "", clean_res)
        match = re.search(r"\[.*\]", clean_res, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        return json.loads(clean_res)
    except Exception as e:
        logger.error(f"Quiz parse error: {e}\nResult: {result}")
        raise HTTPException(status_code=500, detail="Failed to parse LLM response")


@app.get("/map")
async def get_knowledge_map():
    await ensure_rag_ready()
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA

    data = db_manager.get_all_with_embeddings()
    embeddings = data["embeddings"]

    if len(embeddings) == 0:
        return {"points": [], "clusters": []}

    X = np.array(embeddings)

    if len(X) == 1:
        X_3d = np.array([[0.0, 0.0, 0.0]])
        labels = np.array([0])
        n_clusters = 1
    elif len(X) < 3:
        pca = PCA(n_components=1)
        X_1d = pca.fit_transform(X)
        X_3d = np.pad(X_1d, ((0, 0), (0, 2)))
        n_clusters = min(2, len(X))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        labels = kmeans.fit_predict(X)
    else:
        pca = PCA(n_components=3)
        X_3d = pca.fit_transform(X)
        n_clusters = min(5, len(X))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        labels = kmeans.fit_predict(X)

    async def fetch_cluster(i):
        indices = np.where(labels == i)[0]
        sample_docs = [data["documents"][idx] for idx in indices[:3] if data["documents"][idx].strip()]
        if not sample_docs:
            return {
                "id": int(i),
                "label": f"Cluster {i + 1}",
                "count": len(indices),
            }
        sample_text = "\n---\n".join(sample_docs)[:1500]
        prompt = (
            "Give a concise 2-4 word summarizing title for the following technical excerpts. "
            "Return ONLY the 2-4 word title, nothing else, no quotes, no conversational filler.\n\n"
            f"Excerpts:\n{sample_text}\n\nTitle:"
        )
        try:
            title_obj = await asyncio.to_thread(llm_instance.invoke, prompt)
            title = title_obj.content if hasattr(title_obj, "content") else str(title_obj)
            clean_title = title.strip().replace('"', '').replace("'", "")
            if any(fluff in clean_title.lower() for fluff in ["please provide", "sure", "here is", "i cannot", "text to summarize"]) or len(clean_title) > 40:
                clean_title = f"Topic {i + 1}"
        except Exception as e:
            logger.warning(f"Error generating cluster title for cluster {i}: {e}")
            clean_title = f"Topic {i + 1}"
        return {
            "id": int(i),
            "label": clean_title,
            "count": len(indices),
        }

    clusters = []
    for i in range(n_clusters):
        clusters.append(await fetch_cluster(i))

    points = []
    for i, meta in enumerate(data["metadatas"]):
        chunk_type = meta.get("chunk_type", "text") if meta else "text"
        points.append({
            "id": data["ids"][i],
            "x": float(X_3d[i, 0]),
            "y": float(X_3d[i, 1]),
            "z": float(X_3d[i, 2]),
            "cluster": int(labels[i]),
            "source": os.path.basename(meta.get("source", "")) if meta else "",
            "text": data["documents"][i],
            "chunk_type": chunk_type,
        })

    return {"points": points, "clusters": clusters}


# ═══════════════════════════════════════════════════════════════
# NEW ENDPOINTS
# ═══════════════════════════════════════════════════════════════


@app.get("/documents/{name}/pages/{page_number}")
async def get_page_image(name: str, page_number: int):
    """Serve a rendered page image for the PDF viewer."""
    safe_name = re.sub(r'[^\w\-.]', '_', secure_filename(name))
    # page_number can be 1-based (from frontend) or 0-based
    idx = page_number - 1 if page_number > 0 else 0
    img_filename = f"{safe_name}_page_{idx}.png"
    img_path = os.path.join(PAGE_IMAGES_DIR, img_filename)

    if not os.path.exists(img_path):
        # Fallback check if 0-based was directly provided
        alt_path = os.path.join(PAGE_IMAGES_DIR, f"{safe_name}_page_{page_number}.png")
        if os.path.exists(alt_path):
            img_path = alt_path
        else:
            raise HTTPException(status_code=404, detail="Page image not found")

    return FileResponse(img_path, media_type="image/png")


@app.get("/documents/{name}/info")
async def get_document_info(name: str):
    """Get detailed processing info for a document."""
    await ensure_rag_ready()
    chunks = db_manager.get_document_chunks(name)

    if not chunks:
        raise HTTPException(status_code=404, detail="Document not found")

    info = {
        "name": name,
        "total_chunks": len(chunks),
        "chunk_types": {},
        "pages": set(),
        "sections": set(),
        "tables": [],
        "figures": [],
    }

    for chunk in chunks:
        meta = chunk.get("metadata", {})
        ct = meta.get("chunk_type", "text")
        info["chunk_types"][ct] = info["chunk_types"].get(ct, 0) + 1

        page = meta.get("page")
        if page is not None:
            info["pages"].add(page)

        section = meta.get("section")
        if section:
            info["sections"].add(section)

        if ct == "table":
            info["tables"].append({
                "title": meta.get("table_title", ""),
                "page": page + 1 if isinstance(page, int) else None,
            })
        elif ct == "figure":
            info["figures"].append({
                "figure_id": meta.get("figure_id", ""),
                "page": page + 1 if isinstance(page, int) else None,
            })

    info["pages"] = sorted(info["pages"], key=lambda p: int(p) if str(p).isdigit() else 0)
    info["sections"] = sorted([str(s) for s in info["sections"] if s])

    return info


# ── Privacy Mode Endpoints ──

@app.get("/mode")
async def get_mode():
    """Get the current privacy mode ('normal' or 'private')."""
    mode = get_privacy_mode()
    return {"mode": mode, "message": f"System is operating in {mode} mode"}


@app.post("/mode")
async def set_mode(request: ModeRequest):
    """Set the privacy mode at runtime ('normal' or 'private')."""
    try:
        set_privacy_mode(request.mode)
        global qa_chain, qa_chain_technical, llm_instance
        llm_instance = create_llm_instance()
        qa_chain, _ = create_qa_chain(technical_mode=False)
        qa_chain_technical, _ = create_qa_chain(technical_mode=True)
        logger.info(f"Switched privacy mode to: {request.mode}")

        from backend.llm import _is_ollama_available
        ollama_up = _is_ollama_available()
        
        if request.mode == "private" and not ollama_up:
            msg = (
                "Switched to private mode. Ollama is not running — "
                "using Groq API as fallback (API-key based, no data stored)."
            )
        else:
            msg = f"Successfully switched to {request.mode} mode"

        return {
            "mode": request.mode,
            "message": msg,
            "ollama_available": ollama_up,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Document Version Comparison Endpoint ──

@app.post("/compare")
async def compare_docs(request: CompareRequest):
    """Compare two revisions of a technical manual and identify changed numerical values,
    units, warnings, component labels, and tables.
    """
    await ensure_rag_ready()
    try:
        result = await compare_documents(request.doc_a, request.doc_b)
        return result
    except Exception as e:
        logger.error(f"Error comparing documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Interactive Engineering Knowledge Graph Endpoint ──

@app.get("/knowledge-graph")
async def get_knowledge_graph(document: Optional[str] = None):
    """Get the interactive engineering knowledge graph (nodes + explicit relationship edges)."""
    await ensure_rag_ready()
    try:
        graph = await generate_knowledge_graph(document)
        return graph
    except Exception as e:
        logger.error(f"Error generating knowledge graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── NLP Intelligence Analysis Endpoint ──

@app.post("/nlp/analyze")
async def analyze_nlp(request: NLPAnalyzeRequest):
    """Analyze text through the NLP subsystem: tokenization, intent classification,
    NER, relation extraction, semantic similarity, and RRF rank fusion.
    """
    await ensure_rag_ready()
    try:
        result = analyze_nlp_query(request.text)
        return result
    except Exception as e:
        logger.error(f"Error in NLP query analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

