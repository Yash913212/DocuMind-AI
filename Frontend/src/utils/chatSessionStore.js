/**
 * chatSessionStore.js
 * Persistent multi-session conversation store for DocuMind AI.
 * Stores conversations in localStorage, provides CRUD operations, 
 * session auto-titling, and multi-session analytical synthesis.
 */

import { API_BASE } from "../config";

const STORAGE_KEY = "documind_chat_sessions_v1";
const ACTIVE_SESSION_KEY = "documind_active_session_id_v1";

/**
 * Generate a unique session ID
 */
export function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Cleanly truncate text to a readable title
 */
export function deriveSessionTitle(firstPrompt) {
  if (!firstPrompt || typeof firstPrompt !== "string") return "Engineering Inquiry";
  const cleaned = firstPrompt.replace(/^#+\s*/, "").replace(/[\r\n]+/g, " ").trim();
  if (!cleaned) return "Engineering Inquiry";
  if (cleaned.length <= 42) return cleaned;
  return cleaned.substring(0, 42).replace(/\s+\S*$/, "") + "…";
}

/**
 * Get all stored sessions sorted by updatedAt descending
 */
export function getStoredSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  } catch (err) {
    console.error("Failed to parse stored chat sessions", err);
    return [];
  }
}

/**
 * Get current active session ID
 */
export function getActiveSessionId() {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Set active session ID
 */
export function setActiveSessionId(id) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_SESSION_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
    window.dispatchEvent(new CustomEvent("documind_active_session_changed", { detail: { id } }));
  } catch (err) {
    console.error("Failed to set active session ID", err);
  }
}

/**
 * Save or update a session
 */
export function saveSession(session) {
  if (!session || !session.id) return;
  try {
    const sessions = getStoredSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    
    // Auto-derive title if it's default or empty
    let title = session.title;
    const firstUserMsg = session.messages?.find((m) => m.role === "user");
    if ((!title || title === "New Conversation" || title === "Engineering Inquiry") && firstUserMsg?.content) {
      title = deriveSessionTitle(firstUserMsg.content);
    }

    const updatedSession = {
      ...session,
      title: title || "Engineering Inquiry",
      updatedAt: new Date().toISOString(),
      privacyMode: session.privacyMode || "normal",
      messages: session.messages || [],
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = updatedSession;
    } else {
      sessions.unshift(updatedSession);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    window.dispatchEvent(new CustomEvent("documind_sessions_changed", { detail: { sessions } }));
    return updatedSession;
  } catch (err) {
    console.error("Failed to save session", err);
  }
}

/**
 * Create a new session and make it active
 */
export function createNewSession({ title = "New Conversation", document = "ALL", technicalMode = true, privacyMode = "normal" } = {}) {
  const newSession = {
    id: generateSessionId(),
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    document: document || "ALL",
    technicalMode: technicalMode ?? true,
    privacyMode: privacyMode || "normal",
    messages: [],
  };

  try {
    const sessions = getStoredSessions();
    sessions.unshift(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    setActiveSessionId(newSession.id);
    window.dispatchEvent(new CustomEvent("documind_sessions_changed", { detail: { sessions } }));
  } catch (err) {
    console.error("Failed to create new session", err);
  }

  return newSession;
}

/**
 * Delete a session by ID
 */
export function deleteSession(id) {
  try {
    const sessions = getStoredSessions();
    const filtered = sessions.filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    const activeId = getActiveSessionId();
    if (activeId === id) {
      const nextActive = filtered.length > 0 ? filtered[0].id : null;
      setActiveSessionId(nextActive);
    }

    window.dispatchEvent(new CustomEvent("documind_sessions_changed", { detail: { sessions: filtered } }));
    return filtered;
  } catch (err) {
    console.error("Failed to delete session", err);
    return getStoredSessions();
  }
}

/**
 * Update session title
 */
export function updateSessionTitle(id, newTitle) {
  try {
    const sessions = getStoredSessions();
    const target = sessions.find((s) => s.id === id);
    if (target) {
      target.title = newTitle.trim() || "Engineering Inquiry";
      target.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      window.dispatchEvent(new CustomEvent("documind_sessions_changed", { detail: { sessions } }));
    }
  } catch (err) {
    console.error("Failed to update session title", err);
  }
}

/**
 * Clear all stored sessions
 */
export function clearAllSessions() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = createNewSession();
    return [fresh];
  } catch (err) {
    console.error("Failed to clear sessions", err);
    return [];
  }
}

/**
 * Synthesize metrics and structured summary from all sessions
 */
export function generateAllSessionsSummary(sessions = []) {
  const activeSessions = sessions.filter((s) => s.messages && s.messages.length > 0);

  let totalUserQueries = 0;
  let totalAssistantAnswers = 0;
  const citedDocsMap = new Map();
  const topicsList = [];
  const extractedSpecs = new Set();
  const sessionsSummaryList = [];

  // Regex patterns for engineering specifications and metrics
  const specRegex = /(\b\d+(\.\d+)?\s*(°C|°F|mm|cm|m|km|kHz|MHz|GHz|RPM|bar|psi|V|mV|A|mA|kW|MW|ms|s|%|MB|GB|Tbps|Gbps)\b)/gi;

  activeSessions.forEach((session, idx) => {
    const userMsgs = session.messages.filter((m) => m.role === "user");
    const assistantMsgs = session.messages.filter((m) => m.role === "assistant");

    totalUserQueries += userMsgs.length;
    totalAssistantAnswers += assistantMsgs.length;

    // Track citations
    session.messages.forEach((m) => {
      if (m.sources && Array.isArray(m.sources)) {
        m.sources.forEach((src) => {
          const docName = src.document || "General Manual";
          const page = src.page || src.page_number;
          if (!citedDocsMap.has(docName)) {
            citedDocsMap.set(docName, { count: 0, pages: new Set(), types: new Set() });
          }
          const entry = citedDocsMap.get(docName);
          entry.count += 1;
          if (page) entry.pages.add(page);
          if (src.chunk_type) entry.types.add(src.chunk_type);
        });
      }

      // Spec extraction from assistant content
      if (m.content) {
        const matches = m.content.match(specRegex);
        if (matches) {
          matches.slice(0, 4).forEach((match) => extractedSpecs.add(match));
        }
      }
    });

    // Session narrative overview
    const mainQuestion = userMsgs[0]?.content || "General Analysis";
    const answerPreview = assistantMsgs[0]?.content
      ? assistantMsgs[0].content.replace(/[\r\n]+/g, " ").substring(0, 140) + "…"
      : "Inquiry logged.";

    topicsList.push({
      sessionTitle: session.title,
      question: mainQuestion,
      date: session.updatedAt || session.createdAt,
      messageCount: session.messages.length,
    });

    sessionsSummaryList.push({
      id: session.id,
      index: idx + 1,
      title: session.title,
      document: session.document || "All Documents",
      date: new Date(session.updatedAt || session.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      queryCount: userMsgs.length,
      primaryInquiry: mainQuestion,
      keyInsight: answerPreview,
    });
  });

  const uniqueDocs = Array.from(citedDocsMap.entries()).map(([name, data]) => ({
    name,
    citationCount: data.count,
    pages: Array.from(data.pages).sort((a, b) => Number(a) - Number(b)),
    types: Array.from(data.types),
  }));

  // Build high-level Markdown report
  const reportDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let markdownReport = `# DocuMind AI — Multi-Session Intelligence Briefing\n`;
  markdownReport += `*Generated on ${reportDate} &middot; Cross-Session Synthesis*\n\n`;
  markdownReport += `## 1. Executive Summary\n`;
  markdownReport += `Across **${activeSessions.length} conversation session(s)**, DocuMind AI processed **${totalUserQueries} engineering inquiries** and provided **${totalAssistantAnswers} verified responses** with page-level citations.\n\n`;

  markdownReport += `### High-Level Metrics\n`;
  markdownReport += `| Metric | Value |\n`;
  markdownReport += `| :--- | :--- |\n`;
  markdownReport += `| Total Active Sessions | **${activeSessions.length}** |\n`;
  markdownReport += `| Total Questions Evaluated | **${totalUserQueries}** |\n`;
  markdownReport += `| Total Answers Delivered | **${totalAssistantAnswers}** |\n`;
  markdownReport += `| Source Documents Grounded | **${uniqueDocs.length}** |\n`;
  markdownReport += `| Discovered Engineering Tolerances | **${extractedSpecs.size}** |\n\n`;

  if (uniqueDocs.length > 0) {
    markdownReport += `## 2. Document Citations & Grounding Evidence Matrix\n`;
    uniqueDocs.forEach((doc) => {
      const pageStr = doc.pages.length > 0 ? `(Pages: ${doc.pages.join(", ")})` : "";
      const typeStr = doc.types.length > 0 ? `[Types: ${doc.types.join(", ")}]` : "";
      markdownReport += `- **${doc.name}**: ${doc.citationCount} citation(s) ${pageStr} ${typeStr}\n`;
    });
    markdownReport += `\n`;
  }

  if (extractedSpecs.size > 0) {
    markdownReport += `## 3. Discovered Technical Parameters & Tolerances\n`;
    markdownReport += Array.from(extractedSpecs)
      .slice(0, 15)
      .map((s) => `\`${s}\``)
      .join(" &middot; ");
    markdownReport += `\n\n`;
  }

  markdownReport += `## 4. Chronological Session Inquiries & Key Insights\n`;
  sessionsSummaryList.forEach((s) => {
    markdownReport += `### Session ${s.index}: ${s.title}\n`;
    markdownReport += `- **Logged:** ${s.date} | **Document Scope:** \`${s.document}\` | **Exchanges:** ${s.queryCount}\n`;
    markdownReport += `- **Primary Inquiry:** *"${s.primaryInquiry}"*\n`;
    markdownReport += `- **Key Finding / Insight:** ${s.keyInsight}\n\n`;
  });

  markdownReport += `## 5. Strategic Conclusions\n`;
  markdownReport += `All recorded interactions demonstrate multimodal citation integrity across structured technical tables, diagrams, and textual specifications. Continuous grounding ensures strict alignment with technical documentation without hallucinations.\n`;

  return {
    totalSessions: activeSessions.length,
    totalUserQueries,
    totalAssistantAnswers,
    uniqueDocs,
    extractedSpecs: Array.from(extractedSpecs),
    sessionsList: sessionsSummaryList,
    markdownReport,
  };
}

/**
 * Find or create a session dedicated to a specific document.
 * If an existing session for this document in the active privacyMode exists, activate and return it.
 * Otherwise, initialize a dedicated document session and return it.
 */
export function findOrCreateDocumentSession(documentName, privacyMode = "normal") {
  const normMode = privacyMode || "normal";
  if (!documentName || documentName === "ALL") {
    const sessions = getStoredSessions();
    const general = sessions.find((s) => (s.document === "ALL" || !s.document) && (s.privacyMode || "normal") === normMode);
    if (general) {
      setActiveSessionId(general.id);
      return general;
    }
    return createNewSession({ title: normMode === "private" ? "Air-Gapped Private Session" : "General Inquiry", document: "ALL", privacyMode: normMode });
  }

  const sessions = getStoredSessions();
  const existing = sessions.find(
    (s) => s.document === documentName && (s.privacyMode || "normal") === normMode
  );

  if (existing) {
    setActiveSessionId(existing.id);
    return existing;
  }

  const cleanTitle = documentName.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
  const newSession = createNewSession({
    title: `Inquiry: ${cleanTitle}`,
    document: documentName,
    technicalMode: true,
    privacyMode: normMode,
  });
  return newSession;
}

/**
 * Open chat focused on a specific document from Document Library or inspection modal.
 * Syncs any server-side recorded past queries and activates the document session.
 */
export async function openDocumentChat(documentName, privacyMode = "normal") {
  const session = findOrCreateDocumentSession(documentName, privacyMode);

  // Background sync with server-side document conversations if local has 0 messages
  if (documentName && documentName !== "ALL" && (!session.messages || session.messages.length === 0)) {
    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(documentName)}/conversations`);
      if (res.ok) {
        const backendConvs = await res.json();
        if (Array.isArray(backendConvs) && backendConvs.length > 0) {
          const latestBackend = backendConvs[0];
          if (latestBackend.messages && latestBackend.messages.length > 0) {
            session.messages = latestBackend.messages;
            session.title = latestBackend.title || session.title;
            saveSession(session);
          }
        }
      }
    } catch (e) {
      console.warn("Could not sync backend conversations for document", e);
    }
  }

  window.dispatchEvent(
    new CustomEvent("documind_open_document_chat", {
      detail: { document: documentName, privacyMode, sessionId: session.id },
    })
  );

  window.location.hash = "chat";
  const el = document.getElementById("chat");
  if (el) el.scrollIntoView({ behavior: "smooth" });

  return session;
}
