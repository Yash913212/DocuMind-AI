"""
Interactive Engineering Knowledge Graph Engine.

Extracts components, specifications, safety warnings, procedures, figures,
and source pages from technical documentation, establishing explicit semantic
relationships:
- COMPONENT → HAS_SPEC → Specification (e.g., Motor → 400V AC / 90°C)
- COMPONENT → SHOWN_IN → Figure / Wiring Diagram
- COMPONENT → HAS_WARNING → Safety Warning
- COMPONENT → MAINTENANCE → Maintenance Procedure
- COMPONENT → CONNECTS_TO → Connected Component
- ENTITY → ON_PAGE → Document Page Citation
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from backend.database import db_manager
from backend.llm import create_llm_instance

logger = logging.getLogger(__name__)

# In-memory graph cache: { document_name_or_global: graph_data }
_GRAPH_CACHE: Dict[str, Dict] = {}


def clear_knowledge_graph_cache():
    """Clear cached graphs on document modification."""
    global _GRAPH_CACHE
    _GRAPH_CACHE.clear()


def _extract_entities_heuristically(chunks: List[Dict]) -> Dict[str, Any]:
    """Fast deterministic extraction of components, specs, warnings, and figures from chunks."""
    nodes = []
    edges = []
    seen_node_ids = set()

    def add_node(nid: str, label: str, ntype: str, page: Optional[int], doc: str, details: str):
        if nid not in seen_node_ids:
            seen_node_ids.add(nid)
            nodes.append({
                "id": nid,
                "label": label,
                "type": ntype,
                "page": page,
                "document": doc,
                "details": details,
            })

    def add_edge(src: str, tgt: str, rel: str, label: str):
        if src in seen_node_ids and tgt in seen_node_ids:
            edges.append({
                "source": src,
                "target": tgt,
                "relationship": rel,
                "label": label,
            })

    # Regex patterns
    comp_pat = re.compile(
        r'\b(?:Motor|Pump|Valve|Sensor|Relay|Inverter|Controller|Actuator|Switch|Transmitter|Filter|Fan|Heater|Cylinder|Turbine|Generator)\s+[A-Za-z0-9\-\.]+',
        re.IGNORECASE
    )
    spec_pat = re.compile(
        r'(\b[A-Za-z\s]{3,20}?)\s*(?:is|=|:)?\s*([+-]?\d+(?:\.\d+)?\s*(?:°[CF]|bar|psi|kPa|MPa|V|mV|kV|A|mA|kW|W|MW|rpm|Hz|mm|kg|%))',
        re.IGNORECASE
    )
    warn_pat = re.compile(
        r'(?:WARNING|CAUTION|DANGER|SAFETY NOTE)[:\s]+([^\.\n]+(?:\.[^\.\n]+)?)',
        re.IGNORECASE
    )
    proc_pat = re.compile(
        r'(?:Procedure|Step|Maintenance|SOP)[:\s]+([^\.\n]+)',
        re.IGNORECASE
    )

    for chunk in chunks:
        content = chunk.get("content", "")
        meta = chunk.get("metadata", {})
        doc = meta.get("source", "manual.pdf").split("/")[-1]
        page_raw = meta.get("page")
        page = (page_raw + 1) if isinstance(page_raw, int) else 1
        ct = meta.get("chunk_type", "text")

        current_comps = []

        # Find components
        for m in comp_pat.finditer(content):
            comp_name = m.group(0).strip()
            first_word, _, second_word = comp_name.partition(" ")
            if second_word.lower() in {
                "between", "out", "the", "to", "and", "of", "for", "in", "on", "by", "from",
                "with", "is", "are", "can", "will", "a", "an", "through", "into", "over", "under", "all", "its", "modes"
            }:
                continue
            cid = f"comp-{re.sub(r'[^a-zA-Z0-9]', '-', comp_name.lower())}"
            add_node(cid, comp_name, "component", page, doc, f"Technical component referenced on Page {page}")
            current_comps.append(cid)

        # If table, add table figure/spec node
        if ct == "table":
            table_title = meta.get("table_title") or f"Table (Page {page})"
            tid = f"table-{page}-{len(nodes)}"
            add_node(tid, table_title, "figure", page, doc, content[:200])
            for cid in current_comps:
                add_edge(cid, tid, "SHOWN_IN", "Referenced in Table")

        # If figure chunk
        if ct == "figure":
            fig_id = meta.get("figure_id") or f"Figure (Page {page})"
            fid = f"fig-{page}-{len(nodes)}"
            add_node(fid, fig_id, "figure", page, doc, content[:200])
            for cid in current_comps:
                add_edge(cid, fid, "SHOWN_IN", "Diagram Schematic")

        # Find specifications
        for m in spec_pat.finditer(content):
            spec_name = m.group(1).strip().title()
            spec_val = m.group(2).strip()
            if len(spec_name) < 25:
                sid = f"spec-{re.sub(r'[^a-zA-Z0-9]', '-', spec_name.lower())}"
                add_node(sid, f"{spec_name}: {spec_val}", "specification", page, doc, f"Measurement spec: {spec_val}")
                for cid in current_comps:
                    add_edge(cid, sid, "HAS_SPEC", "Rated Value")

        # Find warnings
        for m in warn_pat.finditer(content):
            warn_text = m.group(1).strip()
            wid = f"warn-{page}-{len(nodes)}"
            label = "CAUTION: " + (warn_text[:35] + "..." if len(warn_text) > 35 else warn_text)
            add_node(wid, label, "warning", page, doc, warn_text)
            for cid in current_comps:
                add_edge(cid, wid, "HAS_WARNING", "Safety Alert")

        # Find procedures
        for m in proc_pat.finditer(content):
            proc_text = m.group(1).strip()
            pid = f"proc-{page}-{len(nodes)}"
            label = "SOP: " + (proc_text[:30] + "..." if len(proc_text) > 30 else proc_text)
            add_node(pid, label, "procedure", page, doc, proc_text)
            for cid in current_comps:
                add_edge(cid, pid, "MAINTENANCE", "Procedure")

    return {"nodes": nodes, "edges": edges}


async def generate_knowledge_graph(document_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate or retrieve knowledge graph for a specific document or entire library.
    Caches graph for low-latency visual interaction.
    """
    cache_key = document_name or "__global__"
    if cache_key in _GRAPH_CACHE:
        return _GRAPH_CACHE[cache_key]

    # Retrieve chunks
    if document_name:
        chunks = db_manager.get_document_chunks(document_name)
    else:
        # Get all chunks across all documents
        chunks_dict = db_manager.get_all_with_embeddings()
        metadatas = chunks_dict.get("metadatas", [])
        documents = chunks_dict.get("documents", [])
        ids = chunks_dict.get("ids", [])
        chunks = [
            {"id": ids[i], "content": documents[i], "metadata": metadatas[i]}
            for i in range(len(ids))
        ]

    # No indexed content — return an empty graph instead of placeholder data.
    if not chunks:
        empty_graph = {"nodes": [], "edges": []}
        _GRAPH_CACHE[cache_key] = empty_graph
        return empty_graph

    # Step 1: Heuristic extraction
    graph = _extract_entities_heuristically(chunks)

    # If heuristic found too few nodes (< 5), enrich with LLM extraction on first chunks
    if len(graph.get("nodes", [])) < 6 and chunks:
        try:
            llm = create_llm_instance()
            sample_text = "\n\n".join(c.get("content", "")[:1000] for c in chunks[:4])
            prompt = (
                "You are an engineering knowledge graph builder. Analyze this technical manual content:\n\n"
                f"{sample_text}\n\n"
                "Extract:\n"
                "1. Components (motors, valves, sensors, pumps, controllers, etc.)\n"
                "2. Specifications (voltage, temperature, pressure, flow rate, tolerances)\n"
                "3. Safety warnings or cautions\n"
                "4. Figures, schematics, or wiring diagrams\n"
                "5. Maintenance or operation procedures\n\n"
                "Return a strict JSON object:\n"
                "{\n"
                '  "nodes": [\n'
                '    {"id": "comp-1", "label": "Drive Motor M1", "type": "component", "details": "Description", "page": 1},\n'
                '    {"id": "spec-1", "label": "400V AC", "type": "specification", "details": "Rated voltage", "page": 1}\n'
                "  ],\n"
                '  "edges": [\n'
                '    {"source": "comp-1", "target": "spec-1", "relationship": "HAS_SPEC", "label": "Rated Voltage"}\n'
                "  ]\n"
                "}\n"
                "Only valid JSON."
            )
            res = await llm.ainvoke(prompt)
            raw = res.content if hasattr(res, "content") else str(res)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                llm_graph = json.loads(match.group(0))
                if isinstance(llm_graph, dict) and "nodes" in llm_graph:
                    # Merge nodes and edges
                    existing_ids = {n["id"] for n in graph["nodes"]}
                    for n in llm_graph.get("nodes", []):
                        if n.get("id") and n["id"] not in existing_ids:
                            existing_ids.add(n["id"])
                            graph["nodes"].append(n)
                    for e in llm_graph.get("edges", []):
                        if e.get("source") in existing_ids and e.get("target") in existing_ids:
                            graph["edges"].append(e)
        except Exception as e:
            logger.warning(f"LLM graph extraction fallback error: {e}")

    # Return an empty graph when no entities could be extracted.
    if not graph.get("nodes"):
        graph = {"nodes": [], "edges": []}

    _GRAPH_CACHE[cache_key] = graph
    return graph
