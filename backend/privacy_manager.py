"""
backend/privacy_manager.py
Manages privacy-mode isolation between Public (Normal) and Private (Local-Only) documents.
Ensures that when the system operates in Private Mode, public mode files are strictly excluded
from document listings, searches, retrievals, and RAG groundings.
"""

import json
import logging
import os
from typing import Dict, List, Optional

from backend.config import DATA_DIR, get_privacy_mode, is_private_mode

logger = logging.getLogger(__name__)

PRIVACY_MANIFEST_FILE = os.path.join(DATA_DIR, ".file_privacy.json")


def _load_manifest() -> Dict[str, str]:
    """Load the file-to-privacy-mode mapping."""
    if os.path.exists(PRIVACY_MANIFEST_FILE):
        try:
            with open(PRIVACY_MANIFEST_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            logger.warning(f"Error reading privacy manifest: {e}")

    # Initialize manifest with existing files as 'normal' (public)
    manifest = {}
    try:
        if os.path.exists(DATA_DIR):
            for fname in os.listdir(DATA_DIR):
                if fname.startswith("."):
                    continue
                if fname.lower().endswith((".pdf", ".md", ".txt", ".csv", ".jpg", ".png", ".webp")):
                    manifest[fname] = "normal"
            _save_manifest(manifest)
    except Exception as e:
        logger.warning(f"Error initializing privacy manifest: {e}")

    return manifest


def _save_manifest(manifest: Dict[str, str]) -> None:
    """Save the file-to-privacy-mode mapping."""
    try:
        with open(PRIVACY_MANIFEST_FILE, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving privacy manifest: {e}")


def get_file_privacy(filename: str) -> str:
    """Get the privacy mode of a document ('private' or 'normal')."""
    base_name = os.path.basename(filename)
    manifest = _load_manifest()
    return manifest.get(base_name, "normal")


def set_file_privacy(filename: str, mode: str) -> str:
    """Assign a privacy mode ('private' or 'normal') to a document."""
    if mode not in ("private", "normal"):
        mode = "normal"
    base_name = os.path.basename(filename)
    manifest = _load_manifest()
    manifest[base_name] = mode
    _save_manifest(manifest)
    logger.info(f"Assigned privacy mode '{mode}' to document '{base_name}'")
    return mode


def delete_file_privacy(filename: str) -> None:
    """Remove a document from the privacy manifest."""
    base_name = os.path.basename(filename)
    manifest = _load_manifest()
    if base_name in manifest:
        del manifest[base_name]
        _save_manifest(manifest)


def get_documents_for_mode(mode: Optional[str] = None) -> List[str]:
    """Return all document filenames belonging to the specified mode ('private' or 'normal')."""
    if mode is None:
        mode = get_privacy_mode()
    manifest = _load_manifest()
    return [fname for fname, fmode in manifest.items() if fmode == mode]


def is_document_allowed_in_current_mode(filename: str, current_mode: Optional[str] = None) -> bool:
    """Check if a document is accessible in the active mode.
    
    In 'private' mode: ONLY files marked 'private' are allowed. Public files are excluded!
    In 'normal' mode: ONLY files marked 'normal' (public) are allowed.
    """
    if current_mode is None:
        current_mode = get_privacy_mode()
    file_mode = get_file_privacy(filename)
    return file_mode == current_mode
