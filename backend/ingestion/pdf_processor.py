"""
Page-aware PDF processor using PyMuPDF.
Extracts text, tables, images, and figures while preserving page boundaries
and structural metadata for technical manual processing.
"""

import logging
import os
import re
import uuid
from typing import Dict, List, Optional, Tuple

import pymupdf as fitz  # PyMuPDF
from PIL import Image

from backend.config import (
    DATA_DIR,
    PAGE_IMAGES_DIR,
    EXTRACTED_IMAGES_DIR,
    PAGE_IMAGE_DPI,
    MAX_IMAGE_DIMENSION,
)

logger = logging.getLogger(__name__)


def process_pdf(file_path: str, document_id: str = None) -> Dict:
    """
    Process a PDF file with full page-level awareness.
    
    Returns a dict containing:
    - pages: List of processed page dicts
    - metadata: Document-level metadata
    """
    if document_id is None:
        document_id = str(uuid.uuid4())

    filename = os.path.basename(file_path)
    logger.info(f"Processing PDF: {filename}")

    try:
        doc = fitz.open(file_path)
    except Exception as e:
        logger.error(f"Failed to open PDF {filename}: {e}")
        raise ValueError(f"Could not open PDF file: {e}")

    doc_metadata = {
        "document_id": document_id,
        "document_name": filename,
        "total_pages": len(doc),
        "total_tables": 0,
        "total_figures": 0,
        "total_images": 0,
        "has_toc": len(doc.get_toc()) > 0,
    }

    # Extract table of contents for section mapping
    toc = doc.get_toc()
    section_map = _build_section_map(toc, len(doc))

    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        processed = _process_page(
            page, page_num, filename, document_id, file_path, section_map
        )
        pages.append(processed)

        doc_metadata["total_tables"] += len(processed["tables"])
        doc_metadata["total_figures"] += len(processed["figures"])
        doc_metadata["total_images"] += len(processed["images"])

    doc.close()

    logger.info(
        f"PDF processed: {len(pages)} pages, "
        f"{doc_metadata['total_tables']} tables, "
        f"{doc_metadata['total_figures']} figures, "
        f"{doc_metadata['total_images']} images"
    )

    return {"pages": pages, "metadata": doc_metadata}


def _build_section_map(toc: list, total_pages: int) -> Dict[int, Dict]:
    """Build a mapping from page number to section/subsection from TOC."""
    section_map = {}
    current_section = None
    current_subsection = None

    for entry in toc:
        level, title, page_num = entry[0], entry[1], entry[2]
        # page_num in TOC is 1-based
        pg = page_num - 1

        if level == 1:
            current_section = title
            current_subsection = None
        elif level == 2:
            current_subsection = title

        section_map[pg] = {
            "section": current_section,
            "subsection": current_subsection,
        }

    # Forward-fill section info for pages without explicit TOC entries
    last_info = {"section": None, "subsection": None}
    for pg in range(total_pages):
        if pg in section_map:
            last_info = section_map[pg]
        else:
            section_map[pg] = dict(last_info)

    return section_map


def _process_page(
    page: fitz.Page,
    page_num: int,
    filename: str,
    document_id: str,
    file_path: str,
    section_map: Dict,
) -> Dict:
    """Process a single PDF page — extract text, tables, images, render page image."""

    section_info = section_map.get(page_num, {})

    result = {
        "document_id": document_id,
        "document_name": filename,
        "page_number": page_num,
        "section": section_info.get("section"),
        "subsection": section_info.get("subsection"),
        "text": "",
        "text_blocks": [],
        "tables": [],
        "figures": [],
        "images": [],
        "captions": [],
        "warnings": [],
        "specifications": [],
        "headings": [],
        "page_image_path": None,
        "source": file_path,
    }

    # ── 1. Extract text with structure ──
    result["text"] = page.get_text("text") or ""

    # Extract text blocks with positioning for structure detection
    blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
    for block in blocks.get("blocks", []):
        if block.get("type") == 0:  # Text block
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    if not text:
                        continue
                    font_size = span.get("size", 12)
                    flags = span.get("flags", 0)
                    is_bold = bool(flags & 2**4)

                    result["text_blocks"].append({
                        "text": text,
                        "font_size": round(font_size, 1),
                        "is_bold": is_bold,
                        "bbox": span.get("bbox", []),
                    })

    # ── 2. Detect headings ──
    result["headings"] = _detect_headings(result["text_blocks"])

    # ── 3. Extract tables ──
    result["tables"] = _extract_tables(page, page_num)

    # ── 4. Extract images ──
    result["images"], result["figures"] = _extract_images(
        page, page_num, filename, document_id
    )

    # ── 5. Detect captions ──
    result["captions"] = _detect_captions(result["text"])

    # ── 6. Detect warnings ──
    result["warnings"] = _detect_warnings(result["text"])

    # ── 7. Detect specifications ──
    result["specifications"] = _detect_specifications(result["text"])

    # ── 8. Render page to image ──
    result["page_image_path"] = _render_page_image(page, page_num, filename)

    return result


def _detect_headings(text_blocks: List[Dict]) -> List[Dict]:
    """Detect headings based on font size and bold formatting."""
    if not text_blocks:
        return []

    # Find the most common font size (body text)
    sizes = [b["font_size"] for b in text_blocks if b["text"].strip()]
    if not sizes:
        return []

    from collections import Counter
    size_counts = Counter(sizes)
    body_size = size_counts.most_common(1)[0][0]

    headings = []
    for block in text_blocks:
        text = block["text"].strip()
        if not text or len(text) < 2:
            continue
        # A heading is typically larger than body text or bold with reasonable length
        if block["font_size"] > body_size * 1.15 and len(text) < 200:
            headings.append({
                "text": text,
                "level": 1 if block["font_size"] > body_size * 1.5 else 2,
                "font_size": block["font_size"],
            })
        elif block["is_bold"] and block["font_size"] >= body_size and len(text) < 100:
            headings.append({
                "text": text,
                "level": 3,
                "font_size": block["font_size"],
            })

    return headings


def _extract_tables(page: fitz.Page, page_num: int) -> List[Dict]:
    """Extract tables from a PDF page using PyMuPDF's table detection."""
    tables = []

    try:
        tab_finder = page.find_tables()
        for idx, table in enumerate(tab_finder.tables):
            extracted = table.extract()
            if not extracted or len(extracted) < 2:
                continue

            # First row as headers, rest as data
            headers = [str(cell or "").strip() for cell in extracted[0]]
            rows = []
            for row in extracted[1:]:
                rows.append([str(cell or "").strip() for cell in row])

            # Detect table title from text above the table
            title = _detect_table_title(page, table.bbox, idx)

            tables.append({
                "type": "table",
                "table_index": idx,
                "title": title,
                "page": page_num,
                "headers": headers,
                "rows": rows,
                "bbox": list(table.bbox),
                "row_count": len(rows),
                "col_count": len(headers),
            })

    except Exception as e:
        logger.warning(f"Table extraction failed on page {page_num}: {e}")

    return tables


def _detect_table_title(page: fitz.Page, table_bbox: tuple, table_index: int) -> str:
    """Try to find a title/caption above a table."""
    if not table_bbox:
        return f"Table {table_index + 1}"

    # Look for text in the region just above the table
    x0, y0 = table_bbox[0], table_bbox[1]
    x1 = table_bbox[2]
    search_rect = fitz.Rect(x0 - 10, max(0, y0 - 40), x1 + 10, y0)

    text_above = page.get_text("text", clip=search_rect).strip()
    if text_above:
        # Look for patterns like "Table X:" or "Table X."
        match = re.search(r'(Table\s+[\d.]+[:\s—–-]?\s*.*)', text_above, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        # Use the text if it's short enough to be a title
        if len(text_above) < 100:
            return text_above

    return f"Table {table_index + 1}"


def _extract_images(
    page: fitz.Page, page_num: int, filename: str, document_id: str
) -> Tuple[List[str], List[Dict]]:
    """Extract embedded images from a PDF page."""
    images = []
    figures = []

    try:
        image_list = page.get_images(full=True)
        for img_idx, img_info in enumerate(image_list):
            xref = img_info[0]
            try:
                pix = fitz.Pixmap(page.parent, xref)

                # Skip very small images (likely icons/bullets)
                if pix.width < 50 or pix.height < 50:
                    pix = None
                    continue

                # Convert CMYK to RGB if needed
                if pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)

                # Save the image
                safe_name = re.sub(r'[^\w\-.]', '_', filename)
                img_filename = f"{safe_name}_p{page_num}_img{img_idx}.png"
                img_path = os.path.join(EXTRACTED_IMAGES_DIR, img_filename)
                pix.save(img_path)
                images.append(img_path)

                # Create figure entry
                figure_caption = _detect_figure_caption(page, page_num, img_idx)
                figures.append({
                    "type": "figure",
                    "figure_index": img_idx,
                    "figure_id": figure_caption.get("figure_id", f"Figure (Page {page_num + 1})"),
                    "title": figure_caption.get("caption", ""),
                    "page": page_num,
                    "image_path": img_path,
                    "width": pix.width,
                    "height": pix.height,
                })

                pix = None  # Release memory

            except Exception as e:
                logger.warning(f"Failed to extract image {img_idx} from page {page_num}: {e}")

    except Exception as e:
        logger.warning(f"Image extraction failed on page {page_num}: {e}")

    return images, figures


def _detect_figure_caption(page: fitz.Page, page_num: int, img_idx: int) -> Dict:
    """Try to detect a figure caption near an image."""
    text = page.get_text("text")

    # Look for "Figure X" patterns
    fig_patterns = [
        r'(Figure\s+[\d.]+[:\s—–-]?\s*[^\n]+)',
        r'(Fig\.?\s+[\d.]+[:\s—–-]?\s*[^\n]+)',
    ]

    for pattern in fig_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            # Return the first match (or idx-th if multiple)
            match = matches[min(img_idx, len(matches) - 1)]
            fig_id_match = re.search(r'(Figure|Fig\.?)\s+([\d.]+)', match, re.IGNORECASE)
            fig_id = f"Figure {fig_id_match.group(2)}" if fig_id_match else f"Figure (Page {page_num + 1})"
            return {"figure_id": fig_id, "caption": match.strip()}

    return {"figure_id": f"Figure (Page {page_num + 1})", "caption": ""}


def _detect_captions(text: str) -> List[str]:
    """Detect figure and table captions in page text."""
    captions = []
    patterns = [
        r'((?:Figure|Fig\.?|Table)\s+[\d.]+[:\s—–-]?\s*[^\n]+)',
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        captions.extend([m.strip() for m in matches])
    return captions


def _detect_warnings(text: str) -> List[str]:
    """Detect warning, caution, and note blocks in technical text."""
    warnings = []
    patterns = [
        r'(?:⚠️?\s*)?(?:WARNING|CAUTION|DANGER|NOTE|IMPORTANT)[:\s—–-]+([^\n]+(?:\n(?![A-Z]{4,})[^\n]+)*)',
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        warnings.extend([m.strip() for m in matches])
    return warnings


def _detect_specifications(text: str) -> List[str]:
    """Detect specification-like entries (key: value with units)."""
    specs = []
    # Match patterns like "Maximum Pressure: 200 PSI" or "Temperature Range: -20°C to 80°C"
    pattern = r'([A-Z][a-zA-Z\s]+(?:Range|Limit|Rating|Capacity|Pressure|Temperature|Voltage|Current|Weight|Speed|Torque|Flow|Power))\s*[:=]\s*([^\n]+)'
    matches = re.findall(pattern, text)
    for key, value in matches:
        specs.append(f"{key.strip()}: {value.strip()}")
    return specs


def _render_page_image(page: fitz.Page, page_num: int, filename: str) -> Optional[str]:
    """Render a PDF page to an image file for visual retrieval."""
    try:
        safe_name = re.sub(r'[^\w\-.]', '_', filename)
        img_filename = f"{safe_name}_page_{page_num}.png"
        img_path = os.path.join(PAGE_IMAGES_DIR, img_filename)

        # Don't re-render if already exists
        if os.path.exists(img_path):
            return img_path

        mat = fitz.Matrix(PAGE_IMAGE_DPI / 72, PAGE_IMAGE_DPI / 72)
        pix = page.get_pixmap(matrix=mat)

        # Resize if too large
        if pix.width > MAX_IMAGE_DIMENSION or pix.height > MAX_IMAGE_DIMENSION:
            scale = min(MAX_IMAGE_DIMENSION / pix.width, MAX_IMAGE_DIMENSION / pix.height)
            new_w = int(pix.width * scale)
            new_h = int(pix.height * scale)
            # Save full size first, then resize with PIL
            pix.save(img_path)
            pix = None
            img = Image.open(img_path)
            img = img.resize((new_w, new_h), Image.LANCZOS)
            img.save(img_path)
        else:
            pix.save(img_path)
            pix = None

        return img_path

    except Exception as e:
        logger.warning(f"Page image rendering failed for page {page_num}: {e}")
        return None


def table_to_text(table_data: Dict) -> str:
    """Convert a structured table dict into readable text for embedding."""
    parts = []
    title = table_data.get("title", "")
    page = table_data.get("page", "?")

    if title:
        parts.append(f"Table: {title}")
    parts.append(f"Page: {page + 1}" if isinstance(page, int) else f"Page: {page}")

    headers = table_data.get("headers", [])
    rows = table_data.get("rows", [])

    if headers:
        parts.append("Columns: " + " | ".join(headers))

    for row in rows:
        if headers:
            row_text = "; ".join(
                f"{h}: {v}" for h, v in zip(headers, row) if v.strip()
            )
        else:
            row_text = " | ".join(row)
        parts.append(row_text)

    return "\n".join(parts)


def figure_to_text(figure_data: Dict, vision_description: str = "") -> str:
    """Convert a figure dict and its vision description into text for embedding."""
    parts = []
    fig_id = figure_data.get("figure_id", "Unknown Figure")
    title = figure_data.get("title", "")
    page = figure_data.get("page", "?")

    parts.append(f"{fig_id}")
    if title:
        parts.append(f"Caption: {title}")
    parts.append(f"Page: {page + 1}" if isinstance(page, int) else f"Page: {page}")

    if vision_description:
        parts.append(f"Visual Analysis:\n{vision_description}")

    return "\n".join(parts)
