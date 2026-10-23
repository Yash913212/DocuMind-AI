import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Send,
  Compass,
  MessageSquarePlus,
  Paperclip,
  UploadCloud,
  FileText,
  X,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  Layers,
  Database,
  ShieldCheck,
  BookOpen,
  Lock,
  Globe,
  Clock,
  History,
  MessageSquare,
} from "lucide-react";
import { useUI } from "../context/UIContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { API_BASE } from "../config";
import {
  getStoredSessions,
  getActiveSessionId,
  setActiveSessionId,
  saveSession,
  createNewSession,
  deleteSession,
  updateSessionTitle,
  clearAllSessions,
} from "../utils/chatSessionStore";
import { ConversationHistoryDrawer } from "../components/ConversationHistoryDrawer";
import { DocuMindLogo } from "../components/DocuMindLogo";
import { ConversationSummaryModal } from "../components/ConversationSummaryModal";

function CitationChip({ id, sourceData, onClick }) {
  const getIcon = (type) => {
    switch (type) {
      case "table": return "📊";
      case "figure": return "🖼️";
      case "visual_page": return "👁️";
      case "diagram": return "📐";
      default: return "📄";
    }
  };
  
  return (
    <motion.button
      layoutId={`citation-${id}-${sourceData?.id || id}`}
      whileHover={{ scale: 1.08, y: -1 }}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.16 }}
      onClick={() => onClick(sourceData)}
      className="inline-flex items-center gap-1 justify-center h-5 px-2 ml-1 text-[10px] font-data-mono bg-brass text-white font-semibold rounded hover:bg-[#ff1a14] transition-colors align-middle shadow-sm shadow-brass/25 cursor-pointer"
      title={sourceData?.document || "Source"}
    >
      <span>{getIcon(sourceData?.chunk_type)}</span>
      [{id}]
    </motion.button>
  );
}

function CompassSpinner({ isSpinning }) {
  return (
    <motion.div
      animate={{ rotate: isSpinning ? 360 : 0 }}
      transition={{
        repeat: isSpinning ? Infinity : 0,
        duration: 2,
        ease: "linear",
      }}
      className="text-fog"
    >
      <Compass size={20} />
    </motion.div>
  );
}

export function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeDocument, setActiveDocument] = useState("ALL");
  const [allDocuments, setAllDocuments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [technicalMode, setTechnicalMode] = useState(true); // Default to technical mode
  const { openInspector, privacyMode, setPrivacyMode } = useUI();
  const reduceMotion = useReducedMotion();
  const scrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const dragCounter = useRef(0);

  // Multi-session state management
  const [sessions, setSessions] = useState(() => getStoredSessions());
  const [currentSessionId, setCurrentSessionId] = useState(() => getActiveSessionId());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  // Initialize and sync sessions from localStorage
  useEffect(() => {
    const stored = getStoredSessions();
    setSessions(stored);

    const activeId = getActiveSessionId();
    const active = stored.find((s) => s.id === activeId) || stored[0];

    if (active) {
      setCurrentSessionId(active.id);
      setActiveSessionId(active.id);
      setMessages(active.messages || []);
      if (active.document) setActiveDocument(active.document);
      if (active.technicalMode !== undefined) setTechnicalMode(active.technicalMode);
    } else {
      const fresh = createNewSession({
        document: activeDocument,
        technicalMode,
      });
      setCurrentSessionId(fresh.id);
      setSessions([fresh]);
    }

    const handleSessionsChanged = (e) => {
      if (e.detail?.sessions) {
        setSessions(e.detail.sessions);
      }
    };

    window.addEventListener("documind_sessions_changed", handleSessionsChanged);
    return () => {
      window.removeEventListener("documind_sessions_changed", handleSessionsChanged);
    };
  }, []);

  const handleSelectSession = (sessionId) => {
    // If currently has unsaved active messages, save them first
    if (currentSessionId && messages.length > 0) {
      saveSession({
        id: currentSessionId,
        document: activeDocument,
        technicalMode,
        messages,
      });
    }

    const target = sessions.find((s) => s.id === sessionId);
    if (!target) return;

    setCurrentSessionId(target.id);
    setActiveSessionId(target.id);
    setMessages(target.messages || []);
    if (target.document) setActiveDocument(target.document);
    if (target.technicalMode !== undefined) setTechnicalMode(target.technicalMode);
    setInput("");
    setSuggestions([]);
    toast.success(`Loaded conversation: "${target.title}"`, { id: "session-loaded" });
  };

  const handleNewChat = () => {
    // Save current session before creating a fresh one
    if (currentSessionId && messages.length > 0) {
      saveSession({
        id: currentSessionId,
        document: activeDocument,
        technicalMode,
        messages,
      });
    }

    const fresh = createNewSession({
      title: "New Conversation",
      document: activeDocument,
      technicalMode,
    });

    setCurrentSessionId(fresh.id);
    setActiveSessionId(fresh.id);
    setMessages([]);
    setSuggestions([]);
    setInput("");
    setSessions(getStoredSessions());
    toast.success("New conversation started", { id: "new-chat" });
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }
  };

  const handleDeleteSession = (sessionId) => {
    const updated = deleteSession(sessionId);
    setSessions(updated);

    if (currentSessionId === sessionId) {
      if (updated.length > 0) {
        handleSelectSession(updated[0].id);
      } else {
        const fresh = createNewSession({ document: activeDocument, technicalMode });
        setCurrentSessionId(fresh.id);
        setMessages([]);
        setSessions([fresh]);
      }
    }
    toast.success("Conversation deleted");
  };

  const handleUpdateTitle = (sessionId, newTitle) => {
    updateSessionTitle(sessionId, newTitle);
    setSessions(getStoredSessions());
  };

  const handleClearAllSessions = () => {
    const remaining = clearAllSessions();
    setSessions(remaining);
    if (remaining.length > 0) {
      setCurrentSessionId(remaining[0].id);
      setMessages([]);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const docs = await res.json();
        docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
        setAllDocuments(docs);
      }
    } catch (e) {
      console.error("Failed to load documents", e);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload({ target: { files: [file] } });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setUploadProgress({ phase: "uploading", percent: 0 });

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const textChunk = decoder.decode(value, { stream: true });
          const lines = textChunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));
                if (data.type === "progress") {
                  setUploadProgress({
                    phase: data.phase,
                    percent: data.percent,
                  });
                } else if (data.type === "done") {
                  fetchDocuments();
                  setActiveDocument("ALL");
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content: `You have uploaded **${file.name}**. I can now search across this and all your other documents! What would you like to know?`,
                      sources: [],
                    },
                  ]);
                  setSuggestions([
                    "Summarize my documents",
                    "What are the key takeaways?",
                    "Find connections between the files",
                  ]);
                  setUploadProgress(null);
                  window.dispatchEvent(new Event("documentUpdated"));
                } else if (data.type === "error") {
                  alert(data.message);
                  setUploadProgress(null);
                }
              } catch (e) {
                console.error(e);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload file");
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDocument = async (docName) => {
    if (!docName) return;
    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(docName)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeDocument === docName) setActiveDocument("ALL");
        fetchDocuments();
      } else {
        alert("Failed to delete document");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete document");
    }
  };

  const handleSubmit = async (e, forcedInput = null) => {
    if (e) e.preventDefault();
    const query = forcedInput || input;
    if (!query.trim()) return;

    const newMsg = { role: "user", content: query, timestamp: new Date().toISOString() };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    const initialUpdated = [
      ...messages,
      newMsg,
      { role: "assistant", content: "", isStreaming: true, sources: [], timestamp: new Date().toISOString() },
    ];
    setMessages(initialUpdated);
    setInput("");
    setIsLoading(true);
    setSuggestions([]);

    // Ensure active session exists
    let activeId = currentSessionId;
    if (!activeId) {
      const fresh = createNewSession({ document: activeDocument, technicalMode });
      activeId = fresh.id;
      setCurrentSessionId(activeId);
      setActiveSessionId(activeId);
    }

    // Persist user prompt immediately
    saveSession({
      id: activeId,
      document: activeDocument,
      technicalMode,
      messages: initialUpdated.map((m) => ({ ...m, isStreaming: false })),
    });

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query, 
          history, 
          document: activeDocument === "ALL" ? null : activeDocument,
          technical_mode: technicalMode 
        }),
      });

      if (!response.ok) throw new Error("Chat request failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const textChunk = decoder.decode(value, { stream: true });
          const lines = textChunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));

                setMessages((prev) => {
                  const copy = [...prev];
                  const last = { ...copy[copy.length - 1] };

                  if (data.type === "sources") {
                    last.sources = data.sources;
                  } else if (data.type === "content") {
                    last.content += data.token;
                  } else if (data.type === "end") {
                    last.isStreaming = false;
                    setSuggestions(data.suggestions || []);
                  }

                  copy[copy.length - 1] = last;
                  return copy;
                });
              } catch (e) {
                console.error("Parse error", e);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        last.content += "\n\n*(Error: Unable to connect to the backend)*";
        last.isStreaming = false;
        return copy;
      });
    } finally {
      setIsLoading(false);
      setMessages((latest) => {
        saveSession({
          id: activeId,
          document: activeDocument,
          technicalMode,
          messages: latest.map((m) => ({ ...m, isStreaming: false })),
        });
        setSessions(getStoredSessions());
        return latest;
      });
    }
  };

  const handleCitationClick = (source) => {
    if (!source) return;
    
    let content = `## Source: ${source.document || 'Unknown'}\n\n`;
    content += `**Page:** ${source.page || 'Unknown'}\n\n`;
    content += `**Type:** ${source.chunk_type || 'text'}\n\n`;
    
    if (source.section) content += `**Section:** ${source.section}\n\n`;
    if (source.table_title) content += `**Table:** ${source.table_title}\n\n`;
    if (source.figure_id) content += `**Figure:** ${source.figure_id}\n\n`;
    
    content += `---\n\n${source.text}`;
    
    if (source.image_path) {
      // Create a markdown image link that calls the new page image endpoint
      // Assuming the image path can be accessed or we can pass a URL to the API
      // For now, let's just indicate there's an image. Inspector handles markdown.
      // If we have a page number, we can construct the URL to the new endpoint.
      if (source.page_number) {
        content += `\n\n![Page Image](${API_BASE}/documents/${encodeURIComponent(source.document)}/pages/${source.page_number})`;
      }
    }
    
    openInspector(content);
  };

  return (
    <div 
      className="h-full flex flex-col py-4 sm:py-8 px-4 sm:px-8 relative w-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="chat-ambient pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -16, filter: "blur(8px)" }}
        animate={reduceMotion ? {} : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden mb-4 sm:mb-6 shrink-0 max-w-5xl xl:max-w-6xl mx-auto w-full flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-indigo/85 backdrop-blur-2xl p-4 sm:p-5 sm:px-6 rounded-2xl border border-fog/15 shadow-[0_8px_30px_-5px_rgba(0,0,0,0.15)]"
      >
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/80 to-transparent"
          initial={{ x: "-100%" }}
          animate={reduceMotion ? {} : { x: "100%" }}
          transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
          aria-hidden="true"
        />
        <div className="flex items-center gap-3.5 min-w-0 shrink-0">
          <DocuMindLogo size={42} />
          <div className="min-w-0">
            <h1 className="font-hero text-xl sm:text-2xl text-parchment leading-tight whitespace-nowrap tracking-tight">
              DocuMind AI Chat
            </h1>
            <div className="flex items-center gap-2 text-xs text-fog font-ui-label mt-1">
              <span className="shrink-0 text-fog/80">Grounding:</span>
              <select
                value={activeDocument}
                onChange={(e) => setActiveDocument(e.target.value)}
                className="max-w-[200px] sm:max-w-[280px] bg-ink/80 text-parchment border border-fog/20 rounded-lg px-2.5 py-1 text-xs font-data-mono focus:outline-none focus:border-brass cursor-pointer truncate"
              >
                <option value="ALL">All Indexed Documents</option>
                {allDocuments.map((doc) => (
                  <option key={doc.name} value={doc.name}>
                    {doc.name} ({doc.pages}p, {doc.tables || 0}t)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto justify-between lg:justify-end shrink-0">
          {/* Privacy Engine Mode (Click to Toggle) */}
          <button
            type="button"
            onClick={() => setPrivacyMode(privacyMode === "private" ? "normal" : "private")}
            className={`h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-data-mono flex flex-1 lg:flex-none items-center justify-center gap-1.5 sm:gap-2 shadow-sm cursor-pointer transition-all whitespace-nowrap overflow-hidden relative ${
              privacyMode === "private"
                ? "bg-brass/15 hover:bg-brass/25 text-brass border-brass/40 shadow-sm shadow-brass/20"
                : "bg-ink/60 hover:bg-ink text-parchment border-fog/20 shadow-sm"
            }`}
            title="Engine Privacy: Click to toggle between Local-First Private Mode and Hybrid Cloud Mode"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={privacyMode}
                initial={{ y: 8, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -8, opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1.5"
              >
                {privacyMode === "private" ? (
                  <>
                    <Lock size={12} className="text-brass drop-shadow-[0_0_6px_rgba(225,6,0,0.5)]" />
                    <span className="hidden sm:inline text-fog">Privacy: </span>
                    <span className="font-semibold text-brass">Private</span>
                  </>
                ) : (
                  <>
                    <Globe size={12} className="text-parchment" />
                    <span className="hidden sm:inline text-fog">Privacy: </span>
                    <span className="font-semibold text-parchment">Normal</span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </button>

          {/* Technical Mode Switch */}
          <div
            className="h-9 px-2 sm:px-3 rounded-xl bg-ink/70 border border-fog/15 flex flex-1 lg:flex-none items-center justify-center gap-2 sm:gap-2.5 shadow-sm whitespace-nowrap"
            title="Constrains output to strict numerical matches and page citations"
          >
            <span className="font-ui text-[10px] sm:text-xs text-fog uppercase tracking-wider font-medium">
              <span className="hidden sm:inline">Technical Mode</span>
              <span className="sm:hidden">Tech</span>
            </span>
            <button
              type="button"
              onClick={() => setTechnicalMode(!technicalMode)}
              className={`w-9 h-5 shrink-0 rounded-full p-0.5 transition-colors cursor-pointer ${
                technicalMode ? "bg-brass" : "bg-fog/30"
              }`}
            >
              <motion.div
                className="w-4 h-4 bg-ink rounded-full shadow"
                animate={{ x: technicalMode ? 16 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {/* Subtle Vertical Divider */}
          <div className="w-px h-6 bg-fog/20 hidden lg:block mx-0.5 shrink-0" />

          {/* Past Conversations Drawer Toggle */}
          <motion.button
            type="button"
            whileHover={{ y: -1, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setIsHistoryOpen(true)}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-ink/70 hover:bg-ink text-parchment border border-fog/20 hover:border-brass/40 text-xs font-ui-label font-medium flex flex-1 lg:flex-none items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Open saved past conversations"
          >
            <Clock size={14} className="text-brass shrink-0" />
            <span className="hidden sm:inline">History</span>
            {sessions.filter((s) => s.messages && s.messages.length > 0).length > 0 && (
              <span className="text-[10px] font-data-mono px-1.5 py-0.2 rounded-full bg-brass/20 text-brass border border-brass/30">
                {sessions.filter((s) => s.messages && s.messages.length > 0).length}
              </span>
            )}
          </motion.button>

          {/* Summarize All Conversations Button */}
          <motion.button
            type="button"
            whileHover={{ y: -1, scale: 1.025 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setIsSummaryModalOpen(true)}
            className="h-9 px-2.5 sm:px-3 rounded-xl bg-brass/15 hover:bg-brass text-brass hover:text-white border border-brass/40 text-xs font-ui-label font-semibold flex flex-1 lg:flex-none items-center justify-center gap-1.5 shadow-sm shadow-brass/20 transition-all cursor-pointer whitespace-nowrap"
            title="Summarize all past conversations and extract cross-document insights"
          >
            <Sparkles size={14} className="shrink-0" />
            <span className="hidden sm:inline">Summarize</span>
            <span className="sm:hidden">Summary</span>
          </motion.button>

          {/* New Chat Button */}
          <motion.button
            type="button"
            whileHover={messages.length > 0 ? { y: -1, scale: 1.02 } : {}}
            whileTap={messages.length > 0 ? { scale: 0.97 } : {}}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={handleNewChat}
            disabled={messages.length === 0}
            className={`h-9 px-2.5 sm:px-3.5 rounded-xl font-ui font-semibold text-xs flex flex-1 lg:flex-none items-center justify-center gap-1.5 sm:gap-2 shadow-sm transition-all whitespace-nowrap ${
              messages.length > 0
                ? "bg-brass/15 hover:bg-brass text-brass hover:text-white border border-brass/40 hover:shadow-brass/25 cursor-pointer"
                : "bg-ink/50 text-fog/70 border border-fog/25 cursor-not-allowed"
            }`}
            title={messages.length > 0 ? "Start a fresh conversation" : "Already in a fresh conversation"}
          >
            <MessageSquarePlus size={15} className="shrink-0" />
            <span>New Chat</span>
          </motion.button>
        </div>
      </motion.header>

      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/90 backdrop-blur-md border-2 border-dashed border-brass rounded-2xl m-4 pointer-events-none">
          <div className="text-brass flex flex-col items-center gap-4">
            <UploadCloud size={64} className="animate-bounce" />
            <h2 className="font-hero text-2xl">Drop document to upload</h2>
            <p className="font-ui-label text-sm text-fog">Supports PDF, MD, TXT, CSV, JPG, PNG</p>
          </div>
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-6 sm:space-y-8 pb-28 sm:pb-36 pt-2 max-w-5xl xl:max-w-6xl mx-auto w-full pr-1 sm:pr-2"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <div className="mb-5 animate-light-float filter drop-shadow-[0_12px_30px_rgba(225,6,0,0.3)]">
              <DocuMindLogo size={68} animate={true} />
            </div>

            <h2 className="font-hero text-2xl sm:text-3xl text-parchment mb-2 tracking-tight">
              DocuMind AI Engineering Intelligence
            </h2>
            <p className="font-body text-fog text-sm sm:text-base max-w-xl mb-6">
              Query technical manuals, extract numerical tolerances, analyze wiring diagrams, and inspect verified page-level citations.
            </p>

            {/* Active Document Status Pill */}
            {allDocuments.length > 0 && (
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-indigo/40 border border-brass/25 text-xs font-data-mono text-parchment mb-8 shadow-sm">
                <Database size={14} className="text-brass" />
                <span>
                  Active:{" "}
                  <strong className="text-brass">
                    {activeDocument === "ALL" ? "All Documents" : activeDocument}
                  </strong>
                </span>
                <span className="text-fog">|</span>
                <span className="text-fog">
                  {allDocuments.reduce((acc, d) => acc + (d.pages || 0), 0)} Pages &middot;{" "}
                  {allDocuments.reduce((acc, d) => acc + (d.chunks || 0), 0)} Chunks
                </span>
              </div>
            )}

            {/* Past Conversations Quick Access Strip */}
            {sessions.filter((s) => s.messages && s.messages.length > 0).length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                <motion.button
                  whileHover={{ y: -1, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => setIsHistoryOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo/40 hover:bg-indigo/70 text-fog hover:text-parchment border border-fog/20 text-xs font-ui-label transition-colors cursor-pointer"
                >
                  <Clock size={13} className="text-brass" />
                  <span>
                    {sessions.filter((s) => s.messages && s.messages.length > 0).length} Saved Conversation(s)
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ y: -1, scale: 1.025 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => setIsSummaryModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brass/15 hover:bg-brass text-brass hover:text-white border border-brass/40 text-xs font-ui-label font-semibold transition-all shadow-sm shadow-brass/15 cursor-pointer"
                >
                  <Sparkles size={13} />
                  <span>Summarize All Past Conversations</span>
                </motion.button>
              </div>
            )}

            {/* Curated Prompt Starter Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-3xl text-left mb-6">
              {[
                {
                  icon: "📐",
                  title: "System Architecture",
                  prompt: "What is the end-to-end multimodal architecture of DocuMind AI?",
                  desc: "Explain the ingestion pipeline and retrieval fusion.",
                },
                {
                  icon: "📊",
                  title: "VDocRAG Benchmark",
                  prompt: "How does DocuMind AI compare against VDocRAG (Tanaka et al., CVPR 2025)?",
                  desc: "Review key differences in image vs text-centric RAG.",
                },
                {
                  icon: "🔒",
                  title: "Private Operating Mode",
                  prompt: "Explain how DocuMind AI implements its local-first private mode.",
                  desc: "Security boundary, local-first Ollama, and local ChromaDB.",
                },
                {
                  icon: "📋",
                  title: "Table & Revision Analysis",
                  prompt: "How does DocuMind AI handle structured tables and document revision diffing?",
                  desc: "Preserving row/column matrices and detecting 80°C to 90°C shifts.",
                },
              ].map((item, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => handleSubmit(null, item.prompt)}
                  className="suggestion-card p-4 rounded-xl glass-card hover:border-brass/50 transition-all text-left group cursor-pointer shadow-md"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-lg">{item.icon}</span>
                    <span className="font-ui font-semibold text-sm text-parchment group-hover:text-brass transition-colors">
                      {item.title}
                    </span>
                  </div>
                  <p className="font-body text-xs text-fog line-clamp-2">
                    {item.prompt}
                  </p>
                </motion.button>
              ))}
            </div>

            {/* Quick Upload action */}
            <motion.button
              whileHover={{ y: -1, scale: 1.015 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.16 }}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo/40 hover:bg-indigo/70 text-fog hover:text-parchment border border-fog/20 text-xs font-ui-label transition-colors cursor-pointer"
            >
              <UploadCloud size={15} />
              <span>Upload or drop another document (PDF, Markdown, TXT)</span>
            </motion.button>
          </div>
        ) : (
          messages.map((m, i) => (
            <motion.div
              key={i}
              initial={
                reduceMotion
                  ? false
                  : m.role === "user"
                  ? { opacity: 0, x: 12, y: 10, scale: 0.985, filter: "blur(4px)" }
                  : { opacity: 0, y: 12, scale: 0.99, filter: "blur(4px)" }
              }
              animate={reduceMotion ? {} : { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[85%] font-body group ${
                  m.role === "user"
                    ? "user-msg-bubble text-white rounded-2xl rounded-tr-sm p-4 w-auto"
                    : "glass-card text-parchment p-5 rounded-2xl rounded-tl-sm border border-fog/15 shadow-md w-full"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-fog/10">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-brass/20 border border-brass/30 flex items-center justify-center text-brass">
                        <Compass size={14} />
                      </div>
                      <span className="text-brass font-ui font-medium text-xs tracking-wide">
                        DocuMind AI Intelligence
                      </span>
                    </div>

                    {!m.isStreaming && m.content && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(m.content);
                          toast.success("Answer copied to clipboard");
                        }}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-md bg-ink/50 hover:bg-brass/20 text-fog hover:text-brass text-xs font-ui-label transition-all"
                        title="Copy answer"
                      >
                        <Copy size={13} />
                        <span>Copy</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="markdown-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                          <table
                            className="w-full text-left border-collapse"
                            {...props}
                          />
                        </div>
                      ),
                      th: ({ node, ...props }) => (
                        <th
                          className="border-b border-fog/30 p-2 font-ui-label text-brass bg-indigo/20"
                          {...props}
                        />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="border-b border-fog/10 p-2" {...props} />
                      ),
                      a: ({ node, ...props }) => (
                        <a
                          className="text-brass underline decoration-brass/30 underline-offset-2 hover:decoration-brass"
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }) => (
                        <p
                          className="mb-4 last:mb-0 leading-relaxed"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className="list-disc pl-6 mb-4 space-y-1"
                          {...props}
                        />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol
                          className="list-decimal pl-6 mb-4 space-y-1"
                          {...props}
                        />
                      ),
                      h1: ({ node, ...props }) => (
                        <h1
                          className="text-2xl font-hero text-brass mb-4 mt-6"
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2
                          className="text-xl font-hero text-brass mb-3 mt-5"
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3
                          className="text-lg font-hero text-parchment mb-2 mt-4"
                          {...props}
                        />
                      ),
                      code: ({ node, inline, ...props }) =>
                        inline ? (
                          <code
                            className="bg-ink/50 text-fog px-1.5 py-0.5 rounded text-sm font-data-mono"
                            {...props}
                          />
                        ) : (
                          <pre className="bg-ink/50 p-4 rounded-lg overflow-x-auto text-sm font-data-mono text-fog my-4 border border-fog/20">
                            <code {...props} />
                          </pre>
                        ),
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>

                {m.role === "assistant" &&
                  m.sources &&
                  m.sources.length > 0 &&
                  !m.isStreaming && (
                    <div className="mt-4 pt-4 border-t border-fog/10 flex flex-wrap gap-2">
                      <span className="text-[10px] uppercase font-ui-label text-fog self-center">
                        Sources:
                      </span>
                      {m.sources.map((src, idx) => (
                        <CitationChip
                          key={idx}
                          id={idx + 1}
                          sourceData={src}
                          onClick={handleCitationClick}
                        />
                      ))}
                    </div>
                  )}

                {m.isStreaming && (
                  <span className="inline-flex gap-1.5 ml-2 align-middle h-5 items-center px-2 py-0.5 rounded-full bg-brass/10 border border-brass/25">
                    <motion.span
                      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.1, delay: 0, ease: "easeInOut" }}
                      className="w-1.5 h-1.5 bg-brass rounded-full shadow-[0_0_6px_#e10600]"
                    />
                    <motion.span
                      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.1, delay: 0.22, ease: "easeInOut" }}
                      className="w-1.5 h-1.5 bg-brass rounded-full shadow-[0_0_6px_#e10600]"
                    />
                    <motion.span
                      animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.1, delay: 0.44, ease: "easeInOut" }}
                      className="w-1.5 h-1.5 bg-brass rounded-full shadow-[0_0_6px_#e10600]"
                    />
                  </span>
                )}
              </div>
            </motion.div>
          ))
        )}

        {isUploading && uploadProgress && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink/80 backdrop-blur-md rounded-xl m-4 border border-brass/10"
          >
            <div className="relative w-32 h-32 mb-8">
              {/* Central Core */}
              <motion.div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-brass shadow-[0_0_30px_rgba(192,138,62,0.8)] z-10"
                animate={{ scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* Orbiting Chunks (Data Absorption) */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-parchment shadow-[0_0_5px_#c0c0c0]"
                  initial={{ 
                    x: Math.cos(i * (Math.PI / 4)) * 60, 
                    y: Math.sin(i * (Math.PI / 4)) * 60,
                    opacity: 0,
                    scale: 0
                  }}
                  animate={{ 
                    x: 0, 
                    y: 0,
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0.5]
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "circIn"
                  }}
                />
              ))}
              
              {/* Outer Scanning Ring */}
              <motion.div 
                className="absolute inset-0 rounded-full border border-brass/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute top-0 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass shadow-[0_0_10px_#e10600]" />
                <div className="absolute bottom-0 left-1/2 w-1 h-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-parchment shadow-[0_0_5px_#c0c0c0]" />
              </motion.div>
            </div>
            
            <h3 className="font-hero text-2xl text-brass mb-2 tracking-wider">
              {uploadProgress.phase === "uploading" ? "UPLOADING" : "ANALYZING"}
            </h3>
            <div className="font-data-mono text-fog tracking-widest text-sm">
              {Math.round(uploadProgress.percent)}% COMPLETE
            </div>
          </motion.div>
        )}

        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 mt-4"
          >
            {suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSubmit(null, sug)}
                className="px-3 py-1.5 rounded-full border border-brass/30 text-brass text-sm font-ui-label hover:bg-brass/10 transition-colors"
              >
                {sug}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-ink via-ink/95 to-transparent pointer-events-none z-20">
        <form
          onSubmit={(e) => handleSubmit(e)}
          className="max-w-5xl xl:max-w-6xl mx-auto relative pointer-events-auto"
        >
          <div className="glass-card rounded-2xl border border-fog/12 focus-within:border-brass/60 focus-within:shadow-[0_0_30px_-3px_rgba(225,6,0,0.2),0_0_60px_-6px_rgba(225,6,0,0.08)] transition-all overflow-hidden p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2 px-2 pt-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !isLoading && !isUploading) {
                      handleSubmit(e);
                      if (textareaRef.current) textareaRef.current.style.height = "auto";
                    }
                  }
                }}
                placeholder={
                  activeDocument && activeDocument !== "ALL"
                    ? `Ask a technical question about ${activeDocument}...`
                    : "Ask questions, verify specs, or analyze tables across all documents..."
                }
                className="w-full bg-transparent font-body text-parchment placeholder:text-fog/70 focus:outline-none text-sm sm:text-base resize-none overflow-y-auto leading-relaxed"
                disabled={isLoading || isUploading}
                style={{ minHeight: "38px" }}
              />
            </div>

            <div className="flex items-center justify-between px-2 pt-1.5 border-t border-fog/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-ui-label text-fog hover:text-brass hover:bg-ink/50 transition-colors"
                  title="Upload Document"
                  disabled={isLoading || isUploading}
                >
                  <Paperclip size={15} />
                  <span className="hidden sm:inline">Attach</span>
                </button>

                <span className="text-[11px] font-data-mono text-fog/60 hidden sm:inline">
                  ⏎ to send &middot; ⇧⏎ for new line
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isLoading && <CompassSpinner isSpinning={true} />}
                <button
                  type="submit"
                  className="btn-signal flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white font-semibold text-xs font-ui-label disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                  disabled={!input.trim() || isLoading || isUploading}
                >
                  <span>Send</span>
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.md,.txt,.csv,.jpg,.jpeg,.png,.webp"
            className="hidden"
          />
        </form>
      </div>

      {/* Past Conversations Drawer */}
      <ConversationHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        activeSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onUpdateTitle={handleUpdateTitle}
        onClearAll={handleClearAllSessions}
        onOpenSummary={() => {
          setIsHistoryOpen(false);
          setIsSummaryModalOpen(true);
        }}
      />

      {/* Multi-Session Intelligence Synthesis Modal */}
      <ConversationSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        sessions={sessions}
        onSelectSession={handleSelectSession}
      />
    </div>
  );
}
