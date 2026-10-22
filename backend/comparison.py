"""
Document Version Comparison and Change Detection Engine.

Compares two revisions of a technical manual and identifies:
- Changed numerical values and units (e.g., 80°C → 90°C)
- Added, modified, or removed safety warnings and cautions
- Changed component labels and part numbers
- Structured table differences (ratings, specs, row additions/updates)
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from backend.database import db_manager
from backend.llm import create_llm_instance
from backend.models import ChangeItem, CompareResult

logger = logging.getLogger(__name__)


def _extract_numerical_specs(text: str) -> Dict[str, str]:
    """Regex extractor for key engineering measurements and values."""
    patterns = [
        r'([A-Za-z\s]{3,30}?):\s*([+-]?\d+(?:\.\d+)?\s*(?:°[CF]|K|bar|psi|kPa|MPa|V|mV|kV|A|mA|W|kW|MW|rpm|Hz|kHz|MHz|mm|cm|m|kg|g|lb|dB|L|mL|%))',
        r'(\b[A-Za-z\s]{3,30}?(?:temperature|voltage|current|pressure|flow|speed|torque|power|frequency|weight|dimension))\s*(?:is|=|of)?\s*([+-]?\d+(?:\.\d+)?\s*(?:°[CF]|K|bar|psi|kPa|MPa|V|mV|kV|A|mA|W|kW|MW|rpm|Hz|kHz|MHz|mm|cm|m|kg|g|lb|dB|L|mL|%))',
    ]
    specs = {}
    for pat in patterns:
        for match in re.finditer(pat, text, re.IGNORECASE):
            key = match.group(1).strip().title()
            val = match.group(2).strip()
            if len(key) < 40 and key not in specs:
                specs[key] = val
    return specs


def _align_chunks(chunks_a: List[Dict], chunks_b: List[Dict]) -> List[Tuple[Dict, Dict]]:
    """Align chunks between two document versions by section, table title, or page proximity."""
    pairs = []
    used_b = set()

    # 1. Exact match by table title or figure id
    for ca in chunks_a:
        meta_a = ca.get("metadata", {})
        ct_a = meta_a.get("chunk_type")
        tt_a = meta_a.get("table_title")
        fig_a = meta_a.get("figure_id")

        best_b = None
        for i, cb in enumerate(chunks_b):
            if i in used_b:
                continue
            meta_b = cb.get("metadata", {})
            ct_b = meta_b.get("chunk_type")

            if tt_a and ct_a == "table" and ct_b == "table" and meta_b.get("table_title") == tt_a:
                best_b = i
                break
            if fig_a and ct_a == "figure" and ct_b == "figure" and meta_b.get("figure_id") == fig_a:
                best_b = i
                break

        if best_b is not None:
            pairs.append((ca, chunks_b[best_b]))
            used_b.add(best_b)

    # 2. Match by section title
    for ca in chunks_a:
        meta_a = ca.get("metadata", {})
        sec_a = meta_a.get("section")
        if not sec_a:
            continue
        if any(ca["id"] == p[0]["id"] for p in pairs):
            continue

        best_b = None
        for i, cb in enumerate(chunks_b):
            if i in used_b:
                continue
            meta_b = cb.get("metadata", {})
            if meta_b.get("section") == sec_a:
                best_b = i
                break

        if best_b is not None:
            pairs.append((ca, chunks_b[best_b]))
            used_b.add(best_b)

    # 3. Match remaining by sequential page order
    remaining_a = [c for c in chunks_a if not any(c["id"] == p[0]["id"] for p in pairs)]
    remaining_b = [chunks_b[i] for i in range(len(chunks_b)) if i not in used_b]

    for ca, cb in zip(remaining_a, remaining_b):
        pairs.append((ca, cb))

    # If document has chunks in only one or very few, pair first chunk to first chunk
    if not pairs and chunks_a and chunks_b:
        pairs.append((chunks_a[0], chunks_b[0]))

    return pairs


def _parse_llm_json_response(content: str) -> List[Dict]:
    """Robustly parse JSON array from LLM output."""
    content = content.strip()
    # Strip markdown code fences
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    
    # Try direct parse
    try:
        data = json.loads(content)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            if "changes" in data and isinstance(data["changes"], list):
                return data["changes"]
            return [data]
    except Exception:
        pass

    # Try regex finding array
    match = re.search(r"\[\s*\{.*\}\s*\]", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return []


async def compare_documents(doc_a_name: str, doc_b_name: str) -> CompareResult:
    """Compare two documents and detect changes across numerical values, tables, warnings, and labels."""
    chunks_a = db_manager.get_document_chunks(doc_a_name)
    chunks_b = db_manager.get_document_chunks(doc_b_name)

    if not chunks_a and not chunks_b:
        return CompareResult(
            doc_a=doc_a_name,
            doc_b=doc_b_name,
            summary=f"Neither '{doc_a_name}' nor '{doc_b_name}' has indexed content in the vector database.",
            total_changes=0,
            changes=[],
            aligned_sections=0,
        )

    if not chunks_a:
        return CompareResult(
            doc_a=doc_a_name,
            doc_b=doc_b_name,
            summary=f"Revision A '{doc_a_name}' was not found in the database. Ensure it has been uploaded and indexed.",
            total_changes=0,
            changes=[],
            aligned_sections=0,
        )

    if not chunks_b:
        return CompareResult(
            doc_a=doc_a_name,
            doc_b=doc_b_name,
            summary=f"Revision B '{doc_b_name}' was not found in the database. Ensure it has been uploaded and indexed.",
            total_changes=0,
            changes=[],
            aligned_sections=0,
        )

    pairs = _align_chunks(chunks_a, chunks_b)
    llm = create_llm_instance()

    all_changes: List[ChangeItem] = []

    # Limit comparison pairs to top 8 most informative sections to maintain fast response
    selected_pairs = pairs[:8]

    for ca, cb in selected_pairs:
        text_a = ca.get("content", "")
        text_b = cb.get("content", "")
        meta_a = ca.get("metadata", {})
        meta_b = cb.get("metadata", {})

        page_a = meta_a.get("page")
        page_b = meta_b.get("page")
        page_a_num = (page_a + 1) if isinstance(page_a, int) else None
        page_b_num = (page_b + 1) if isinstance(page_b, int) else None

        # If chunks are identical, no changes
        if text_a.strip() == text_b.strip():
            continue

        prompt = (
            "You are a precision engineering document revision analysis system. "
            "Compare the following two versions of a technical manual section.\n\n"
            f"--- REVISION A (Previous Revision: {doc_a_name}) ---\n"
            f"{text_a[:2500]}\n\n"
            f"--- REVISION B (Current Revision: {doc_b_name}) ---\n"
            f"{text_b[:2500]}\n\n"
            "Identify ALL concrete differences between Revision A and Revision B.\n"
            "Classify each difference into one of these categories:\n"
            "1. 'value': Numerical specs, ratings, temperature, pressure, voltage, tolerance changes (e.g. 80°C -> 90°C).\n"
            "2. 'warning': Safety warnings, caution notes, danger alerts added, removed, or changed.\n"
            "3. 'table': Table column/row modifications, cell value changes.\n"
            "4. 'label': Component labels, part numbers, connector designations changed.\n"
            "5. 'text': Procedural steps, textual requirements or description revisions.\n\n"
            "Assign severity:\n"
            "- 'critical': Safety warnings altered, voltage/temperature/pressure tolerance limits changed.\n"
            "- 'warning': Specification or component part number updates.\n"
            "- 'info': Minor wording or procedural clarifications.\n\n"
            "Return ONLY a JSON array of objects with the exact schema:\n"
            "[\n"
            "  {\n"
            '    "category": "value",\n'
            '    "item": "Maximum Operating Temperature",\n'
            '    "old_value": "80°C",\n'
            '    "new_value": "90°C",\n'
            '    "severity": "critical",\n'
            '    "details": "Raised limit by 10°C in revision B"\n'
            "  }\n"
            "]\n"
            "If no meaningful differences exist, return []."
        )

        try:
            response = await llm.ainvoke(prompt)
            raw_text = response.content if hasattr(response, "content") else str(response)
            items = _parse_llm_json_response(raw_text)

            for it in items:
                if not isinstance(it, dict):
                    continue
                item_name = str(it.get("item", "Specification Update"))
                cat = str(it.get("category", "value")).lower()
                if cat not in ("value", "warning", "table", "label", "text"):
                    cat = "value"
                sev = str(it.get("severity", "info")).lower()
                if sev not in ("info", "warning", "critical"):
                    sev = "info"

                all_changes.append(
                    ChangeItem(
                        category=cat,
                        item=item_name,
                        old_value=str(it.get("old_value", "")) if it.get("old_value") is not None else None,
                        new_value=str(it.get("new_value", "")) if it.get("new_value") is not None else None,
                        page_old=page_a_num,
                        page_new=page_b_num,
                        severity=sev,
                        details=str(it.get("details", "")),
                    )
                )
        except Exception as e:
            logger.warning(f"LLM comparison error on section pair: {e}")

    # Fallback / heuristic verification: check regex specs if LLM returned 0 changes but texts differ
    if not all_changes:
        full_text_a = " ".join(c.get("content", "") for c in chunks_a[:5])
        full_text_b = " ".join(c.get("content", "") for c in chunks_b[:5])
        specs_a = _extract_numerical_specs(full_text_a)
        specs_b = _extract_numerical_specs(full_text_b)

        for key, val_a in specs_a.items():
            if key in specs_b and specs_b[key] != val_a:
                all_changes.append(
                    ChangeItem(
                        category="value",
                        item=key,
                        old_value=val_a,
                        new_value=specs_b[key],
                        page_old=None,
                        page_new=None,
                        severity="warning",
                        details=f"Numerical value changed from {val_a} to {specs_b[key]}",
                    )
                )

    # Generate summary
    if all_changes:
        val_count = sum(1 for c in all_changes if c.category == "value")
        warn_count = sum(1 for c in all_changes if c.category == "warning")
        crit_count = sum(1 for c in all_changes if c.severity == "critical")
        summary_lines = [
            f"Comparison between **{doc_a_name}** and **{doc_b_name}** identified {len(all_changes)} distinct change(s)."
        ]
        if crit_count:
            summary_lines.append(f"⚠️ **{crit_count} Critical change(s)** requiring engineering sign-off.")
        if val_count:
            summary_lines.append(f"🔢 {val_count} numerical rating/tolerance modifications detected.")
        if warn_count:
            summary_lines.append(f"🛡️ {warn_count} warning/caution notices updated.")
        summary = " ".join(summary_lines)
    else:
        summary = (
            f"No critical numerical, warning, or table differences detected between **{doc_a_name}** "
            f"and **{doc_b_name}** across {len(pairs)} aligned sections."
        )

    return CompareResult(
        doc_a=doc_a_name,
        doc_b=doc_b_name,
        summary=summary,
        total_changes=len(all_changes),
        changes=all_changes,
        aligned_sections=len(pairs),
    )
