"""
Natural Language Processing (NLP) Subsystem for DocuMind AI.

Provides text segmentation, tokenization analysis, linguistic intent classification,
named entity recognition (NER), relation extraction (RE), semantic similarity scoring,
and reciprocal rank fusion (RRF) mathematical simulations.
"""

import math
import os
import re
from typing import Any, Dict, List, Tuple

from backend.database import db_manager


TECHNICAL_COMPONENTS_REGEX = re.compile(
    r"\b(?:(?:Grade|Type|Model|Part|Series|Class)\s+[A-Z0-9]+(?:\s+[A-Za-z]+)?\s+(?:Pump|Motor|Valve|Actuator|Flange|Turbine|Inverter|Breaker|Cylinder|Sensor)|(?:Drive|Hydraulic|Relief|Induction|Variable\s+Displacement)?\s*(?:Pump|Motor|Valve|Actuator|Flange|Turbine|Inverter|Breaker|Cylinder|Sensor)\s+(?:[A-Z0-9]+-[A-Z0-9]+|[A-Z]\d+|[A-Z0-9]{2,})|[A-Z]{1,3}-\d{1,4}[A-Z]?)\b",
    re.IGNORECASE,
)

METRIC_REGEX = re.compile(
    r"\b(\d+(?:\.\d+)?\s*(?:MPa|ksi|bar|psi|°C|°F|V(?:\s*AC|\s*DC)?|kV|A|mA|kW|MW|RPM|Hz|kHz|ms|μs|mm|cm|m|kg|kN|N\s*m|L/min|gpm))\b",
    re.IGNORECASE,
)

STANDARDS_REGEX = re.compile(
    r"\b(ASME(?:\s+[A-Za-z0-9\s]+)?|ASTM\s+[A-Z0-9]+|ISO\s+\d+|IEC\s+\d+|API\s+\d+|IEEE\s+\d+|SOP-\d+)\b",
    re.IGNORECASE,
)


OPERATIONAL_VERBS = {
    "verify", "extract", "identify", "calculate", "calibrate", "measure",
    "inspect", "replace", "lubricate", "isolate", "disconnect", "adjust",
    "compare", "monitor", "synthesize", "ground", "check", "determine"
}


def _tokenize_words(text: str) -> List[Dict[str, Any]]:
    """Tokenize input into annotated linguistic tokens."""
    tokens = []
    # Match words, numbers with units, or punctuation
    pattern = re.compile(r"(\w+[\w\.\-]*|\S)")
    matches = list(pattern.finditer(text))

    for idx, match in enumerate(matches):
        word = match.group(0)
        start_char = match.start()
        end_char = match.end()

        # Categorize token
        if METRIC_REGEX.match(word) or re.match(r"^\d+(?:\.\d+)?$", word):
            category = "metric"
            pos_tag = "CD (Cardinal Number / Unit)"
        elif re.match(r"^[A-Z0-9\-_]{2,}$", word) or TECHNICAL_COMPONENTS_REGEX.search(word):
            category = "component"
            pos_tag = "NNP (Proper Technical Noun)"
        elif word.lower() in OPERATIONAL_VERBS:
            category = "verb"
            pos_tag = "VB (Operational Action Verb)"
        elif re.match(r"^[^\w\s]$", word):
            category = "punct"
            pos_tag = "PUNCT (Delimiter)"
        elif len(word) > 1 and word[0].isupper():
            category = "component"
            pos_tag = "NNP (Proper Noun)"
        else:
            category = "general"
            pos_tag = "NN / JJ (General Lexicon)"

        tokens.append({
            "text": word,
            "token_id": 1000 + idx,
            "pos_tag": pos_tag,
            "category": category,
            "start_char": start_char,
            "end_char": end_char,
        })

    return tokens


def _classify_intent_detailed(text: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Compute normalized intent probability distribution across 4 core NLP classes."""
    lower_text = text.lower()

    scores = {
        "factual": 1.0,
        "table": 0.2,
        "diagram": 0.2,
        "procedural": 0.2,
    }

    # Intent signals
    table_signals = ["table", "matrix", "row", "column", "yield", "tensile", "minimum", "maximum", "value", "rating", "tolerance", "limit", "sheet", "astm", "asme"]
    diagram_signals = ["schematic", "diagram", "circuit", "figure", "drawing", "p&id", "pinout", "wiring", "layout", "flow", "cad", "blueprint", "visual"]
    procedural_signals = ["procedure", "how to", "step", "calibrate", "sop", "maintenance", "install", "replace", "troubleshoot", "instruction", "order", "sequence"]
    factual_signals = ["what is", "define", "identify", "part number", "model", "serial", "who", "when", "verify", "which"]

    for signal in table_signals:
        if signal in lower_text:
            scores["table"] += 1.8
    for signal in diagram_signals:
        if signal in lower_text:
            scores["diagram"] += 2.2
    for signal in procedural_signals:
        if signal in lower_text:
            scores["procedural"] += 2.0
    for signal in factual_signals:
        if signal in lower_text:
            scores["factual"] += 1.5

    # Normalize to softmax-like distribution
    total = sum(scores.values())
    intent_scores = []
    descriptions = {
        "factual": "Direct entity specification & parameter verification query",
        "table": "Structured tabular matrix & numerical limit lookup",
        "diagram": "Visual engineering schematic, CAD drawing or P&ID layout",
        "procedural": "Sequential standard operating procedure (SOP) or maintenance protocol",
    }

    for intent, raw_val in scores.items():
        confidence = round(raw_val / total, 3)
        intent_scores.append({
            "intent": intent,
            "confidence": confidence,
            "description": descriptions.get(intent, ""),
        })

    intent_scores.sort(key=lambda x: x["confidence"], reverse=True)
    detected_intent = intent_scores[0]["intent"]
    return detected_intent, intent_scores


def _extract_entities_and_relations(text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Extract domain entities (NER) and structural relationships (RE)."""
    entities = []
    seen = set()

    # Standards
    for m in STANDARDS_REGEX.finditer(text):
        val = m.group(0).strip()
        if val not in seen:
            seen.add(val)
            entities.append({
                "entity": val,
                "type": "STANDARD",
                "start_char": m.start(),
                "end_char": m.end(),
            })

    # Metrics
    for m in METRIC_REGEX.finditer(text):
        val = m.group(0).strip()
        if val not in seen:
            seen.add(val)
            entities.append({
                "entity": val,
                "type": "SPECIFICATION",
                "start_char": m.start(),
                "end_char": m.end(),
            })

    # Components
    for m in TECHNICAL_COMPONENTS_REGEX.finditer(text):
        val = m.group(0).strip()
        if val not in seen:
            seen.add(val)
            entities.append({
                "entity": val,
                "type": "COMPONENT",
                "start_char": m.start(),
                "end_char": m.end(),
            })

    # Warnings
    warning_match = re.search(r"\b(DANGER|WARNING|CAUTION|ALERT|HAZARD)\b[:\s\-]*([^\.\,\;\n]+)", text, re.IGNORECASE)
    if warning_match:
        val = warning_match.group(0).strip()
        if val not in seen:
            seen.add(val)
            entities.append({
                "entity": val,
                "type": "WARNING",
                "start_char": warning_match.start(),
                "end_char": warning_match.end(),
            })

    # Derive Relations (RE)
    relations = []
    components = [e["entity"] for e in entities if e["type"] == "COMPONENT"]
    specs = [e["entity"] for e in entities if e["type"] == "SPECIFICATION"]
    standards = [e["entity"] for e in entities if e["type"] == "STANDARD"]
    warnings = [e["entity"] for e in entities if e["type"] == "WARNING"]

    for comp in components:
        for spec in specs:
            relations.append({"source": comp, "relation": "HAS_SPEC", "target": spec})
        for std in standards:
            relations.append({"source": comp, "relation": "GOVERNED_BY", "target": std})
        for warn in warnings:
            relations.append({"source": comp, "relation": "HAS_WARNING", "target": warn})

    # Fallback relation if empty
    if not relations and entities:
        if len(entities) >= 2:
            relations.append({
                "source": entities[0]["entity"],
                "relation": "ASSOCIATED_WITH",
                "target": entities[1]["entity"],
            })

    return entities, relations


def _chunk_label(chunk: Dict[str, Any]) -> str:
    """Build a human-readable label from a real indexed chunk."""
    meta = chunk.get("metadata") or {}
    source = os.path.basename(str(meta.get("source", ""))) or "Unknown document"
    page = meta.get("page")
    page_label = f"Page {page + 1}" if isinstance(page, int) and page >= 0 else "Page unknown"
    snippet = re.sub(r"\s+", " ", chunk.get("content", "")).strip()
    if len(snippet) > 110:
        snippet = snippet[:110] + "..."
    return f"{source} · {page_label} · {snippet}"


def _compute_semantic_similarities(query: str) -> List[Dict[str, Any]]:
    """Compute cosine similarity against the actual indexed document chunks."""
    try:
        results = db_manager.similarity_search(query, k=5)
    except Exception:
        return []

    similarities = []
    for doc, score in results:
        meta = doc.metadata or {}
        chunk_type = meta.get("chunk_type", "text")
        category = {
            "text": "Text Chunk",
            "table": "Table Chunk",
            "figure": "Figure Chunk",
            "image": "Image Chunk",
            "visual_page": "Visual Page",
        }.get(chunk_type, "Document Chunk")
        snippet = re.sub(r"\s+", " ", doc.page_content).strip()
        if len(snippet) > 110:
            snippet = snippet[:110] + "..."
        source = os.path.basename(str(meta.get("source", ""))) or "Unknown document"
        page = meta.get("page")
        page_label = f"Page {page + 1}" if isinstance(page, int) and page >= 0 else "Page unknown"

        similarities.append({
            "target": f"{source} · {page_label}: {snippet}",
            "category": category,
            "similarity": round(max(0.0, min(1.0, float(score))), 3),
        })

    return similarities


def _tokenize_for_search(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _rank_lexically(query: str, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Rank indexed chunks with BM25 over their actual text."""
    if not chunks:
        return []

    tokenized = [_tokenize_for_search(c.get("content", "")) for c in chunks]
    total_docs = len(tokenized)
    avg_length = sum(len(tokens) for tokens in tokenized) / total_docs or 1.0

    doc_freq: Dict[str, int] = {}
    for tokens in tokenized:
        for term in set(tokens):
            doc_freq[term] = doc_freq.get(term, 0) + 1

    query_terms = _tokenize_for_search(query)
    k1, b = 1.5, 0.75
    scored = []

    for idx, tokens in enumerate(tokenized):
        term_freq: Dict[str, int] = {}
        for term in tokens:
            term_freq[term] = term_freq.get(term, 0) + 1

        score = 0.0
        for term in query_terms:
            if term not in term_freq:
                continue
            idf = math.log(1 + (total_docs - doc_freq.get(term, 0) + 0.5) / (doc_freq.get(term, 0) + 0.5))
            denominator = term_freq[term] + k1 * (1 - b + b * len(tokens) / avg_length)
            score += idf * (term_freq[term] * (k1 + 1)) / denominator

        scored.append({"chunk": chunks[idx], "score": score})

    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored


def _compute_rrf_preview(query: str) -> Dict[str, Any]:
    """Fuse real dense and BM25 rankings from the indexed document chunks."""
    k = 60
    chunks = db_manager.get_all_chunks()
    if not chunks:
        return {"fusion_constant_k": k, "fused_candidates": []}

    chunk_by_id = {c["id"]: c for c in chunks}
    content_to_id = {}
    for c in chunks:
        content_to_id.setdefault(c.get("content", ""), c["id"])

    try:
        dense_results = db_manager.similarity_search(query, k=min(10, len(chunks)))
    except Exception:
        dense_results = []

    dense_ids = []
    for doc, _score in dense_results:
        chunk_id = content_to_id.get(doc.page_content)
        if chunk_id and chunk_id not in dense_ids:
            dense_ids.append(chunk_id)

    lexical_results = _rank_lexically(query, chunks)
    lexical_ids = [
        item["chunk"]["id"]
        for item in lexical_results
        if item["score"] > 0
    ][:10]

    candidate_ids = list(dict.fromkeys(dense_ids + lexical_ids))
    if not candidate_ids:
        candidate_ids = [item["chunk"]["id"] for item in lexical_results[:10]]

    fused_results = []
    for chunk_id in candidate_ids:
        chunk = chunk_by_id.get(chunk_id)
        if not chunk:
            continue
        dense_rank = dense_ids.index(chunk_id) + 1 if chunk_id in dense_ids else len(dense_ids) + 1
        bm25_rank = lexical_ids.index(chunk_id) + 1 if chunk_id in lexical_ids else len(lexical_ids) + 1
        fused_score = round(1.0 / (k + dense_rank) + 1.0 / (k + bm25_rank), 5)

        fused_results.append({
            "id": chunk_id,
            "name": _chunk_label(chunk),
            "dense_rank": dense_rank,
            "bm25_rank": bm25_rank,
            "rrf_score": fused_score,
            "formula": f"1/({k}+{dense_rank}) + 1/({k}+{bm25_rank}) = {fused_score}",
        })

    fused_results.sort(key=lambda item: item["rrf_score"], reverse=True)
    return {
        "fusion_constant_k": k,
        "fused_candidates": fused_results[:10],
    }


def analyze_nlp_query(text: str) -> Dict[str, Any]:
    """Execute end-to-end NLP analysis pipeline on input text."""
    clean_text = text.strip() if text else "Verify minimum tensile yield strength for Grade 316L flange at elevated 350°C"
    tokens = _tokenize_words(clean_text)
    detected_intent, intent_scores = _classify_intent_detailed(clean_text)
    entities, relations = _extract_entities_and_relations(clean_text)
    similarities = _compute_semantic_similarities(clean_text)
    rrf_preview = _compute_rrf_preview(clean_text)

    return {
        "text": clean_text,
        "token_count": len(tokens),
        "character_count": len(clean_text),
        "estimated_tokens": tokens,
        "detected_intent": detected_intent,
        "intent_scores": intent_scores,
        "entities": entities,
        "relations": relations,
        "semantic_similarities": similarities,
        "bm25_dense_fusion_preview": rrf_preview,
    }
