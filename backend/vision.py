"""
Vision processing module for diagram/schematic/image understanding.
Uses Qwen2.5-VL via HuggingFace Inference API with specialized prompts
for technical manual content.
"""

import base64
import logging
import mimetypes
from typing import Dict, List, Optional

import requests

from backend.config import HF_TOKEN, VISION_MODEL, GROQ_API_KEY, is_private_mode

logger = logging.getLogger(__name__)

# Ollama OpenAI-compatible Chat API URL
VISION_API_URL = "http://localhost:11434/v1/chat/completions"


def _encode_image_base64(image_path: str) -> str:
    """Encode an image file as base64 data URL."""
    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type:
        mime_type = "image/jpeg"
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{img_b64}"


def _call_vision_api(image_data_url: str, prompt: str, max_tokens: int = 1500) -> Optional[str]:
    """Call the Vision API with an image and prompt.
    In private mode or when HF_TOKEN is not configured, uses local Ollama.
    """
    if not is_private_mode() and HF_TOKEN:
        url = "https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-11B-Vision-Instruct/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {HF_TOKEN}"
        }
        payload = {
            "model": "meta-llama/Llama-3.2-11B-Vision-Instruct",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                }
            ],
            "max_tokens": max_tokens,
        }
    else:
        url = VISION_API_URL
        headers = {
            "Content-Type": "application/json",
        }
        payload = {
            "model": VISION_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                }
            ],
            "max_tokens": max_tokens,
        }

    try:
        res = requests.post(url, headers=headers, json=payload, timeout=120)

        try:
            json_res = res.json()
        except Exception:
            logger.error(f"Invalid JSON returned from Vision API ({url}): {res.text[:200]}")
            return None

        if isinstance(json_res, dict) and "error" in json_res:
            logger.error(f"Vision API error: {json_res['error']}")
            return None

        if "choices" in json_res and len(json_res["choices"]) > 0:
            return json_res["choices"][0]["message"]["content"]

        logger.warning(f"Unexpected vision API response: {json_res}")
        return None

    except requests.exceptions.ConnectionError as e:
        logger.error(f"Network error reaching Vision API ({url}): {e}")
        return None
    except requests.exceptions.Timeout:
        logger.error(f"Vision API request timed out ({url}).")
        return None
    except Exception as e:
        logger.error(f"Vision API error: {e}")
        return None


def describe_image(image_path: str) -> str:
    """
    General image description for uploaded images.
    Preserves the original OCR/analysis prompt from the existing system.
    """
    image_data_url = _encode_image_base64(image_path)

    prompt = (
        "You are an image analysis and OCR system. Analyze the provided image carefully. "
        "Tasks: 1. Detect all visible text. 2. Transcribe the text exactly as it appears. "
        "3. Preserve numbers, symbols, punctuation and capitalization. 4. Identify the language of each text region. "
        "5. Identify important objects in the image. 6. Describe the overall scene. "
        "7. If the image contains a document, receipt, sign, label, poster or screenshot, extract its structured information. "
        "8. Do not invent text that is not visible. Return ONLY valid JSON: "
        '{ "detected_text": [], "languages": [], "objects": [], "scene_description": "", "document_type": "", "structured_data": {} }'
    )

    result = _call_vision_api(image_data_url, prompt)
    if result:
        return result
    return "Failed to generate description."


def analyze_technical_page(image_path: str) -> Dict:
    """
    Analyze a technical manual page image for diagrams, schematics,
    tables, component labels, and other technical content.
    
    Returns a structured analysis dict.
    """
    image_data_url = _encode_image_base64(image_path)

    prompt = (
        "You are a technical documentation analysis system. Analyze this page from a technical manual. "
        "Identify and extract:\n"
        "1. DIAGRAM TYPE: What kind of diagram/schematic is shown (flowchart, circuit, hydraulic, piping, block diagram, etc.)? "
        "If no diagram, say 'none'.\n"
        "2. COMPONENT LABELS: List all visible component names, part numbers, labels (e.g., V1, P3, Motor A).\n"
        "3. CONNECTIONS: Describe how components are connected (e.g., 'P1 connects to V1', arrows, flow direction).\n"
        "4. FIGURE CAPTION: Any figure number and caption visible.\n"
        "5. TABLE CONTENT: If a table is visible, describe its headers and key data.\n"
        "6. WARNINGS: Any safety warnings, caution notices, or notes.\n"
        "7. SPECIFICATIONS: Any numerical specifications, measurements, or values.\n"
        "8. TEXT SUMMARY: Brief summary of any body text visible.\n\n"
        "IMPORTANT: Do NOT invent information. If something is unclear, mark it as [UNCERTAIN]. "
        "Return the analysis as structured text, NOT JSON. Use clear section headers."
    )

    result = _call_vision_api(image_data_url, prompt, max_tokens=2000)

    analysis = {
        "raw_analysis": result or "",
        "has_diagram": False,
        "has_table": False,
        "has_figure": False,
        "components": [],
        "connections": [],
        "warnings": [],
        "specifications": [],
        "description": "",
        "uncertain": False,
    }

    if result:
        result_lower = result.lower()
        analysis["has_diagram"] = any(
            kw in result_lower
            for kw in ["diagram", "schematic", "flowchart", "circuit", "piping", "block diagram"]
        ) and "none" not in result_lower[:100]
        analysis["has_table"] = "table" in result_lower and "no table" not in result_lower
        analysis["has_figure"] = "figure" in result_lower
        analysis["uncertain"] = "[uncertain]" in result_lower
        analysis["description"] = result

    return analysis


def analyze_diagram(image_path: str) -> Dict:
    """
    Deep analysis of a diagram or schematic image.
    Extracts component relationships, flow direction, and spatial layout.
    """
    image_data_url = _encode_image_base64(image_path)

    prompt = (
        "You are analyzing a technical diagram or schematic. Extract ALL of the following:\n\n"
        "DIAGRAM TYPE: (e.g., hydraulic schematic, electrical circuit, P&ID, block diagram)\n\n"
        "COMPONENTS (list each with its label/ID):\n"
        "- Label = Full Name\n\n"
        "CONNECTIONS (describe each connection):\n"
        "- Source → Destination (type of connection)\n\n"
        "FLOW DIRECTION: (if applicable)\n\n"
        "SYMBOLS: (any standard engineering symbols used)\n\n"
        "LEGEND: (if a legend is present, transcribe it)\n\n"
        "SPATIAL RELATIONSHIPS: (top/bottom, left/right arrangement)\n\n"
        "WARNINGS OR NOTES: (any callouts or annotations)\n\n"
        "Be precise. Do NOT invent components or connections that aren't visible. "
        "Mark uncertain elements with [UNCERTAIN]."
    )

    result = _call_vision_api(image_data_url, prompt, max_tokens=2000)

    return {
        "raw_analysis": result or "",
        "description": result or "Unable to analyze diagram.",
    }


def analyze_table_image(image_path: str) -> Dict:
    """
    Analyze an image containing a table.
    Extracts headers, rows, and values.
    """
    image_data_url = _encode_image_base64(image_path)

    prompt = (
        "You are analyzing an image of a table from a technical document. "
        "Extract the table contents precisely:\n\n"
        "1. TABLE TITLE/CAPTION: (if visible above or below the table)\n"
        "2. COLUMN HEADERS: List each column header exactly as shown.\n"
        "3. TABLE DATA: For each row, list the values for each column.\n"
        "4. UNITS: Note any units of measurement.\n"
        "5. FOOTNOTES: Any footnotes or notes associated with the table.\n\n"
        "Preserve exact numbers, units, and formatting. "
        "Do NOT round numbers or change units. "
        "If a cell is empty, mark it as [EMPTY]. "
        "If text is unclear, mark it as [UNCLEAR]."
    )

    result = _call_vision_api(image_data_url, prompt, max_tokens=2000)

    return {
        "raw_analysis": result or "",
        "description": result or "Unable to analyze table.",
    }
