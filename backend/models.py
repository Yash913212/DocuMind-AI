"""
Pydantic models for request/response schemas.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ── Chat ──

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str
    document: Optional[str] = None
    history: Optional[List[ChatMessage]] = None
    technical_mode: bool = False


# ── Quiz ──

class QuizRequest(BaseModel):
    document: str
    count: int = 5
    kind: str = "quiz"  # or "flashcards"


# ── Technical Query ──

class TechnicalQueryRequest(BaseModel):
    query: str
    document: Optional[str] = None
    query_type: Optional[str] = None  # factual, procedural, specification, table, diagram, etc.


# ── Document Page ──

class PageElement(BaseModel):
    """Represents an extracted element from a document page."""
    type: str  # "text", "table", "figure", "image", "diagram", "warning", "specification"
    content: str
    page_number: int
    metadata: Dict[str, Any] = {}


class TableData(BaseModel):
    """Structured table representation."""
    type: str = "table"
    title: Optional[str] = None
    page: int
    headers: List[str] = []
    rows: List[List[str]] = []
    caption: Optional[str] = None
    metadata: Dict[str, Any] = {}


class FigureData(BaseModel):
    """Structured figure/diagram representation."""
    type: str = "figure"
    figure_id: Optional[str] = None
    title: Optional[str] = None
    page: int
    description: str = ""
    component_labels: List[str] = []
    connections: List[str] = []
    image_path: Optional[str] = None
    metadata: Dict[str, Any] = {}


class ProcessedPage(BaseModel):
    """Complete representation of a processed document page."""
    document_id: str
    document_name: str
    page_number: int
    section: Optional[str] = None
    subsection: Optional[str] = None
    text: str = ""
    tables: List[TableData] = []
    figures: List[FigureData] = []
    images: List[str] = []  # paths to extracted images
    captions: List[str] = []
    warnings: List[str] = []
    specifications: List[str] = []
    page_image_path: Optional[str] = None
    metadata: Dict[str, Any] = {}


class SourceReference(BaseModel):
    """Citation/source metadata for an answer."""
    document: str
    page: int
    type: str  # "text", "table", "figure", "diagram"
    title: Optional[str] = None
    figure: Optional[str] = None
    table: Optional[str] = None
    confidence: float = 0.0
    content_preview: str = ""


class DocumentInfo(BaseModel):
    """Enhanced document metadata for the library."""
    name: str
    chunks: int = 0
    pages: int = 0
    tables: int = 0
    figures: int = 0
    images: int = 0
    size: int = 0
    type: str = "unknown"
    uploaded_at: Optional[str] = None
    source: str = ""
    processing_status: str = "pending"
    text_indexed: bool = False
    tables_indexed: bool = False
    visual_indexed: bool = False
    multimodal_ready: bool = False


# ── Privacy Mode ──

class ModeRequest(BaseModel):
    mode: str  # "normal" or "private"


class ModeResponse(BaseModel):
    mode: str
    message: str


# ── Document Comparison ──

class CompareRequest(BaseModel):
    doc_a: str
    doc_b: str


class ChangeItem(BaseModel):
    category: str  # "value", "warning", "table", "label", "text"
    item: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    page_old: Optional[int] = None
    page_new: Optional[int] = None
    severity: str = "info"  # "info", "warning", "critical"
    details: Optional[str] = None


class CompareResult(BaseModel):
    doc_a: str
    doc_b: str
    summary: str
    total_changes: int
    changes: List[ChangeItem]
    aligned_sections: int = 0


# ── NLP Intelligence Analysis ──

class TokenInfo(BaseModel):
    text: str
    token_id: int
    pos_tag: str
    category: str  # component, metric, value, verb, punct, general


class IntentScore(BaseModel):
    intent: str
    confidence: float
    description: str


class SemanticSimilarityItem(BaseModel):
    target: str
    category: str
    similarity: float


class EntityExtractionItem(BaseModel):
    entity: str
    type: str  # COMPONENT, SPECIFICATION, WARNING, PROCEDURE, STANDARD
    start_char: int
    end_char: int


class RelationExtractionItem(BaseModel):
    source: str
    relation: str  # HAS_SPEC, SHOWN_IN, HAS_WARNING, MAINTENANCE, CONNECTS_TO
    target: str


class NLPAnalyzeRequest(BaseModel):
    text: str


class NLPAnalyzeResponse(BaseModel):
    text: str
    token_count: int
    character_count: int
    estimated_tokens: List[TokenInfo]
    detected_intent: str
    intent_scores: List[IntentScore]
    entities: List[EntityExtractionItem]
    relations: List[RelationExtractionItem]
    semantic_similarities: List[SemanticSimilarityItem]
    bm25_dense_fusion_preview: Dict[str, Any]

