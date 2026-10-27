"""
backend/conversation_manager.py
Persists document-centric conversation histories to local storage.
Allows users to click any document in the Document Library or Chat selector
and immediately resume/view all past questions, answers, and interactions
asked specifically for that document.
"""

import json
import logging
import os
from typing import Any, Dict, List, Optional

from backend.config import DATA_DIR, get_privacy_mode
from backend.privacy_manager import get_file_privacy

logger = logging.getLogger(__name__)

CONVERSATIONS_FILE = os.path.join(DATA_DIR, ".document_conversations.json")


def _load_conversations() -> Dict[str, List[Dict[str, Any]]]:
    """Load the document-to-conversations mapping."""
    if os.path.exists(CONVERSATIONS_FILE):
        try:
            with open(CONVERSATIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            logger.warning(f"Error reading document conversations: {e}")
    return {}


def _save_conversations(data: Dict[str, List[Dict[str, Any]]]) -> None:
    """Save the document-to-conversations mapping."""
    try:
        with open(CONVERSATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving document conversations: {e}")


def get_conversations_for_document(
    document_name: str,
    privacy_mode: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieve all conversation sessions recorded for a specific document."""
    base_name = os.path.basename(document_name)
    all_convs = _load_conversations()
    doc_convs = all_convs.get(base_name, [])

    if privacy_mode:
        return [c for c in doc_convs if (c.get("privacy_mode") or "normal") == privacy_mode]
    return doc_convs


def save_document_conversation(
    document_name: str,
    session: Dict[str, Any],
) -> None:
    """Save or update a conversation session tied to a specific document."""
    if not document_name or document_name == "ALL":
        return

    base_name = os.path.basename(document_name)
    all_convs = _load_conversations()
    if base_name not in all_convs:
        all_convs[base_name] = []

    session_id = session.get("id")
    if not session_id:
        return

    # Check if session already exists
    existing_idx = next(
        (i for i, s in enumerate(all_convs[base_name]) if s.get("id") == session_id),
        None,
    )
    existing_session = all_convs[base_name][existing_idx] if existing_idx is not None else None
    incoming_msgs = session.get("messages", [])

    final_msgs = incoming_msgs
    if existing_session and len(incoming_msgs) < len(existing_session.get("messages", [])):
        existing_msgs = existing_session.get("messages", [])
        final_msgs = list(existing_msgs)
        for im in incoming_msgs:
            if not any(em.get("content") == im.get("content") and em.get("role") == im.get("role") for em in existing_msgs):
                final_msgs.append(im)

    doc_privacy = get_file_privacy(base_name)
    resolved_privacy = session.get("privacy_mode") or doc_privacy or "normal"
    session_data = {
        "id": session_id,
        "title": session.get("title", f"Chat with {base_name}"),
        "document": base_name,
        "privacy_mode": resolved_privacy,
        "updatedAt": session.get("updatedAt"),
        "messages": final_msgs,
        "user_query_count": len([m for m in final_msgs if m.get("role") == "user"]),
    }

    if existing_idx is not None:
        all_convs[base_name][existing_idx] = session_data
    else:
        all_convs[base_name].insert(0, session_data)

    _save_conversations(all_convs)
    logger.info(f"Saved conversation '{session_id}' for document '{base_name}' ({len(final_msgs)} messages)")


def get_document_conversation_stats() -> Dict[str, Dict[str, Any]]:
    """Get conversation counts and latest query for all documents."""
    all_convs = _load_conversations()
    stats = {}
    for doc_name, sessions in all_convs.items():
        total_queries = sum(s.get("user_query_count", 0) for s in sessions)
        latest_session = sessions[0] if sessions else None
        last_query = None
        if latest_session and latest_session.get("messages"):
            user_msgs = [m for m in latest_session["messages"] if m.get("role") == "user"]
            if user_msgs:
                last_query = user_msgs[-1].get("content")

        stats[doc_name] = {
            "session_count": len(sessions),
            "total_queries": total_queries,
            "last_active": latest_session.get("updatedAt") if latest_session else None,
            "last_query": last_query,
        }
    return stats
