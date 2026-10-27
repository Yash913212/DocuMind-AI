"""
LLM chain setup and RAG prompt management.
Provides both the original general-purpose prompt and the new
technical-manual-specialized prompt.
"""

import logging
import requests
from typing import Optional

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq

from backend.config import GROQ_API_KEY, OPENROUTER_API_KEY, LLM_PRIMARY, LLM_FALLBACK_1, LLM_FALLBACK_2, USE_ONLY_OLLAMA, is_private_mode

logger = logging.getLogger(__name__)

# ── General-Purpose RAG Prompt (preserved from original) ──
GENERAL_SYSTEM_PROMPT = (
    "You are an AI assistant designed for advanced question-answering. "
    "Use the retrieved context to provide the most accurate and optimal answer. "
    "CRITICAL INSTRUCTION FOR FORMATTING: Do NOT default to using tables. You must dynamically generate the structure of your response based solely on the content and the user's request. "
    "Use paragraphs for narratives, bullet points for summaries, and numbered lists for steps. ONLY use a table if the user explicitly asks for one or if the data is strictly comparative with complete data for all columns (never create columns with null or empty '—' values). "
    "Include relevant emojis to make it visually appealing. "
    "If you don't know the answer, just say that you don't know.\n\n"
    "Context:\n{context}"
)

# ── Technical Manual RAG Prompt ──
TECHNICAL_SYSTEM_PROMPT = (
    "You are a Technical Documentation Assistant specializing in analyzing engineering manuals, "
    "specifications, schematics, and technical procedures. You answer questions ONLY from the "
    "retrieved evidence below.\n\n"
    
    "## Core Rules\n"
    "1. Answer ONLY from the retrieved context. NEVER hallucinate specifications, values, or procedures.\n"
    "2. Do NOT invent component relationships or fabricate connections not shown in the evidence.\n"
    "3. Preserve exact numerical values and units from the source material.\n"
    "4. Distinguish between EXPLICIT facts and INFERRED information. Label inferences clearly.\n"
    "5. When evidence is insufficient, say: 'The available documentation does not contain enough information to answer this.'\n"
    "6. If multiple sources are needed, explain the relationship between them.\n\n"
    
    "## Citation Format\n"
    "Always cite your sources at the end of the answer using this format:\n"
    "📄 **Page X** — [Type]: [Title/Description]\n\n"
    "Where [Type] is one of: Text, Table, Figure, Diagram, Specification\n\n"
    
    "## Response Structure\n"
    "- Lead with the direct answer.\n"
    "- Support with specific evidence from the retrieved context.\n"
    "- Use exact values from tables/specifications.\n"
    "- Reference figure/table numbers when available.\n"
    "- End with source citations.\n\n"
    
    "## Evidence Context\n"
    "Each piece of evidence below is tagged with its type (text/table/figure/visual) "
    "and source page number:\n\n"
    "{context}"
)

# ── Document Whole-Book / Whole-Document Summary Prompt ──
SUMMARY_SYSTEM_PROMPT = (
    "You are an expert Document Intelligence and Literary Synthesis Assistant. "
    "Your objective is to generate an in-depth, well-structured, and comprehensive executive summary "
    "of the document based on the chronologically sampled evidence excerpts below.\n\n"
    
    "## Guidelines\n"
    "1. Thoroughly synthesize the excerpts to cover the entire narrative/document from start to finish.\n"
    "2. Format your response clearly in Github markdown with bold headers and bullet points:\n"
    "   - 📖 **Executive Overview & Core Premise**: Document title, author, central premise, and primary message.\n"
    "   - 🧭 **Key Phases & Chronological Milestones / Chapter Breakdown**: Major sections/eras covered in the text with bullet points detailing key events, projects, or concepts.\n"
    "   - 🚀 **Major Projects, Breakthroughs & Achievements**: Significant milestones, technical developments, or historical decisions detailed in the text.\n"
    "   - 💡 **Core Philosophy, Leadership & Key Takeaways**: The author's philosophy, management principles, personal reflections, and overarching lessons.\n"
    "3. Incorporate specific names, places, project names, and dates from the excerpts.\n"
    "4. End with verified page citations referencing the pages sampled across the document.\n\n"
    
    "## Context Excerpts (Sampled Across the Document):\n"
    "{context}"
)


def is_summary_query(query: str) -> bool:
    """Detect if a user query is asking for a summary/overview of a document or book."""
    if not query:
        return False
    q = query.lower().strip()
    summary_keywords = [
        "summarize", "summarise", "summary", "summaries", "summarie",
        "synopsis", "overview", "recap", "tldr", "abstract",
        "takeaway", "takeaways", "key takeaways", "key takeaway", "main takeaways",
        "main points", "key points", "highlights", "core themes", "key lessons", "lessons learned",
        "whole book", "entire book", "whole document", "entire document",
        "whole of the book", "whole of the document",
        "what is this book about", "what is the book about",
        "what is this document about", "what is the document about",
        "explain the book", "explain this book", "outline of the book",
        "chapter-wise", "chapter breakdown", "full summary", "comprehensive summary",
        "give me a summary", "provide a summary", "give summary", "brief of the book"
    ]
    return any(kw in q for kw in summary_keywords)


def _is_ollama_available() -> bool:
    """Check if Ollama is running and reachable on localhost."""
    try:
        resp = requests.get("http://localhost:11434/api/tags", timeout=2)
        return resp.status_code == 200
    except Exception:
        return False


def create_llm_instance():
    """Create the LLM instance.
    
    If USE_ONLY_OLLAMA is True or privacy mode is active, uses local Ollama
    (llama3.2:latest) exclusively with num_ctx=8192.
    Otherwise, uses Ollama as primary with cloud fallbacks (Groq -> OpenRouter).
    """
    ollama_up = _is_ollama_available()

    # ── Strict Ollama-first / Local-only mode ──
    if USE_ONLY_OLLAMA or is_private_mode():
        if ollama_up:
            logger.info("Ollama-first active: using local Ollama (llama3.2:latest) with num_ctx=8192.")
            return ChatOllama(model=LLM_PRIMARY, temperature=0.0, num_ctx=8192)
        
        # If Ollama is temporarily down and cloud is allowed as fallback
        if not USE_ONLY_OLLAMA and GROQ_API_KEY:
            logger.warning(
                "Private mode: Ollama is not running. "
                "Falling back to Groq API (API-key based, no data stored)."
            )
            return ChatGroq(
                model=LLM_FALLBACK_1,
                api_key=GROQ_API_KEY,
                temperature=0.0,
            )
        
        # Ollama required but not reachable
        logger.warning(
            "USE_ONLY_OLLAMA is active. Defaulting to ChatOllama(model=%s, num_ctx=8192).",
            LLM_PRIMARY
        )
        return ChatOllama(model=LLM_PRIMARY, temperature=0.0, num_ctx=8192)

    # ── Normal mode: Ollama 1st (if running) → Groq → OpenRouter ──
    if ollama_up:
        primary_llm = ChatOllama(model=LLM_PRIMARY, temperature=0.0, num_ctx=8192)
        fallbacks = []
        if GROQ_API_KEY:
            fallbacks.append(
                ChatGroq(
                    model=LLM_FALLBACK_1,
                    api_key=GROQ_API_KEY,
                    temperature=0.0,
                    max_retries=3,
                )
            )
        if OPENROUTER_API_KEY and OPENROUTER_API_KEY != "your-openrouter-api-key":
            fallbacks.append(
                ChatOpenAI(
                    model=LLM_FALLBACK_2,
                    api_key=OPENROUTER_API_KEY,
                    base_url="https://openrouter.ai/api/v1",
                )
            )
        if fallbacks:
            return primary_llm.with_fallbacks(fallbacks)
        return primary_llm

    # If Ollama is not up, use Groq directly
    if GROQ_API_KEY:
        groq_llm = ChatGroq(
            model=LLM_FALLBACK_1,
            api_key=GROQ_API_KEY,
            temperature=0.0,
            max_retries=3,
        )
        if OPENROUTER_API_KEY and OPENROUTER_API_KEY != "your-openrouter-api-key":
            fallback_2_llm = ChatOpenAI(
                model=LLM_FALLBACK_2,
                api_key=OPENROUTER_API_KEY,
                base_url="https://openrouter.ai/api/v1",
            )
            return groq_llm.with_fallbacks([fallback_2_llm])
        return groq_llm

    return ChatOllama(model=LLM_PRIMARY, temperature=0.0, num_ctx=8192)


def create_qa_chain(technical_mode: bool = False, summary_mode: bool = False):
    """Create the question-answering chain.
    
    Args:
        technical_mode: If True, uses the technical manual prompt.
        summary_mode: If True, uses the comprehensive document summary prompt.
                      Otherwise, uses the general-purpose prompt.
    """
    llm = create_llm_instance()

    if summary_mode:
        system_prompt = SUMMARY_SYSTEM_PROMPT
    elif technical_mode:
        system_prompt = TECHNICAL_SYSTEM_PROMPT
    else:
        system_prompt = GENERAL_SYSTEM_PROMPT

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ]
    )

    return create_stuff_documents_chain(llm, prompt), llm


def classify_query_type(query: str, llm) -> str:
    """
    Classify a query into a category to optimize retrieval strategy.
    """
    # Fast path: check for whole-document summary/overview queries
    if is_summary_query(query):
        return "summary"

    classification_prompt = (
        "Classify the following technical question into exactly ONE category. "
        "Return ONLY the category name, nothing else.\n\n"
        "Categories:\n"
        "- summary (asking for a summary, overview, synopsis, or full breakdown of a document or book)\n"
        "- factual (general facts about the document)\n"
        "- procedural (how-to, steps, procedures)\n"
        "- specification (specific values, measurements, limits)\n"
        "- table_lookup (answerable from a data table)\n"
        "- diagram_lookup (about a diagram, schematic, or figure)\n"
        "- component_id (identifying a component or part)\n"
        "- comparison (comparing items)\n"
        "- troubleshooting (debugging, problem-solving)\n"
        "- cross_page (needs info from multiple sections)\n"
        "- multimodal (needs both text and visual info)\n\n"
        f"Question: {query}\n\n"
        "Category:"
    )

    try:
        result = llm.invoke(classification_prompt)
        category = result.content.strip().lower().replace('"', '').replace("'", "")
        valid_categories = {
            "summary", "factual", "procedural", "specification", "table_lookup",
            "diagram_lookup", "component_id", "comparison",
            "troubleshooting", "cross_page", "multimodal",
        }
        if category in valid_categories:
            return category
        # Try to find a valid category in the response
        for cat in valid_categories:
            if cat in category:
                return cat
        return "factual"
    except Exception as e:
        logger.warning(f"Query classification failed: {e}. Defaulting to 'factual'.")
        return "factual"


def format_context_for_technical_prompt(evidence_items: list) -> str:
    """
    Format retrieved evidence items into structured context for the technical prompt.
    Each item gets tagged with its type and page number.
    """
    formatted_parts = []

    for idx, item in enumerate(evidence_items, 1):
        doc = item if hasattr(item, "page_content") else item[0]
        meta = doc.metadata or {}
        
        chunk_type = meta.get("chunk_type", "text")
        page = meta.get("page", "?")
        source = meta.get("source", "Unknown")

        if isinstance(page, int) and page >= 0:
            page_label = f"Page {page + 1}"
        else:
            page_label = str(page) if page != "?" else "Unknown Page"

        type_label = {
            "text": "📝 TEXT",
            "table": "📊 TABLE",
            "figure": "🖼️ FIGURE",
            "visual_page": "👁️ VISUAL PAGE",
            "diagram": "📐 DIAGRAM",
        }.get(chunk_type, "📝 TEXT")

        header = f"[Evidence {idx}] {type_label} — {page_label} ({source})"
        
        # Add table-specific metadata if available
        table_title = meta.get("table_title", "")
        figure_id = meta.get("figure_id", "")
        
        extra_info = ""
        if table_title:
            extra_info += f"\nTable: {table_title}"
        if figure_id:
            extra_info += f"\nFigure: {figure_id}"

        formatted_parts.append(
            f"{header}{extra_info}\n{doc.page_content}\n{'─' * 60}"
        )

    return "\n\n".join(formatted_parts)


def format_context_for_summary_prompt(evidence_items: list) -> str:
    """Format chronological document excerpts for summary synthesis."""
    import os
    parts = []
    for idx, item in enumerate(evidence_items, 1):
        doc = item if hasattr(item, "page_content") else item[0]
        meta = doc.metadata or {}
        page = meta.get("page", 0)
        page_num = page + 1 if isinstance(page, int) and page >= 0 else "?"
        source = os.path.basename(meta.get("source", "Document"))
        
        parts.append(
            f"=== [Excerpt {idx} | Page {page_num} of {source}] ===\n{doc.page_content.strip()}"
        )
    return "\n\n".join(parts)
