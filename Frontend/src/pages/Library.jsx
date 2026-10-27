import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Trash2,
  UploadCloud,
  FileJson,
  Info,
  X,
  Layers,
  Table,
  Image as ImageIcon,
  Search,
  MessageSquare,
  GitCompare,
  Database,
  Sparkles,
  Plus,
  ShieldCheck,
  Globe,
  Lock,
  Unlock,
  Clock,
  ArrowRight,
  History,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_BASE } from "../config";
import { useUI } from "../context/UIContext";
import { openDocumentChat } from "../utils/chatSessionStore";
import { CountUp, Reveal } from "../components/CinematicFX";

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(dm)} ${sizes[i]}`;
}

function FileCard({ file, onDelete, onInfo, onTogglePrivacy, activeMode }) {
  const isPDF = file.type === ".pdf";
  const isPrivate = file.privacy_mode === "private";

  const handleCardClick = () => {
    openDocumentChat(file.name, file.privacy_mode || activeMode);
  };

  const navigateToCompare = (e) => {
    e.stopPropagation();
    window.location.hash = "compare";
    const el = document.getElementById("compare");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.9,
        y: 15,
        transition: { duration: 0.25 },
      }}
      onClick={handleCardClick}
      className="holo-card relative group p-5 rounded-2xl glass-card hover:border-brass/50 transition-all duration-300 flex flex-col justify-between h-64 overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-brass/10 hover:-translate-y-1 cursor-pointer"
    >
      {/* Corner Glow Accent */}
      <div className={`absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none transition-all ${
        isPrivate ? "bg-emerald-500/10 group-hover:bg-emerald-500/20" : "bg-brass/10 group-hover:bg-brass/20"
      }`} />

      <div>
        <div className="mb-3 flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-ink/70 border border-fog/15 text-brass">
              {isPDF ? <FileText size={18} /> : <FileJson size={18} className="text-moss" />}
            </div>
            {isPrivate ? (
              <span className="text-[10px] font-data-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <Lock size={10} /> Private
              </span>
            ) : (
              <span className="text-[10px] font-data-mono uppercase tracking-wider text-fog/80 bg-ink/60 px-2 py-0.5 rounded-full border border-fog/15 flex items-center gap-1">
                <Globe size={10} /> Public
              </span>
            )}
          </div>

          {file.multimodal_ready && (
            <span className="text-[10px] font-data-mono uppercase tracking-wider text-brass bg-brass/15 px-2.5 py-0.5 rounded-full border border-brass/30">
              Multimodal
            </span>
          )}
        </div>

        <h3
          className="font-ui font-medium text-parchment line-clamp-2 text-sm mb-2 group-hover:text-brass transition-colors"
          title={file.name}
        >
          {file.name}
        </h3>

        <div className="flex flex-wrap gap-1.5 text-[11px] text-fog font-ui-label mb-2">
          {file.pages > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-ink/50 border border-fog/10">
              📄 {file.pages} {file.pages === 1 ? "page" : "pages"}
            </span>
          )}
          {file.tables > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-ink/50 border border-fog/10">
              📊 {file.tables} tables
            </span>
          )}
          {file.figures > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-ink/50 border border-fog/10">
              🖼️ {file.figures} figures
            </span>
          )}
        </div>

        {/* Conversation Activity Pill */}
        <div className="mt-1">
          {file.total_queries > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brass/15 border border-brass/30 text-brass text-[10px] font-data-mono font-medium">
              <MessageSquare size={10} />
              {file.total_queries} {file.total_queries === 1 ? "query" : "queries"} asked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink/40 border border-fog/10 text-fog/60 text-[10px] font-data-mono">
              <MessageSquare size={10} />
              Click to start chat
            </span>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-fog/10 flex items-center justify-between mt-2">
        <span className="font-data-mono text-fog text-[11px]">
          {formatBytes(file.size)} &middot; {file.chunks} {file.chunks === 1 ? "chunk" : "chunks"}
        </span>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openDocumentChat(file.name, file.privacy_mode || activeMode)}
            className="p-1.5 rounded-lg bg-ink/60 hover:bg-brass/20 text-fog hover:text-brass transition-colors"
            title="Open conversation for this document"
          >
            <MessageSquare size={14} />
          </button>
          <button
            onClick={() => onTogglePrivacy(file.name, isPrivate ? "normal" : "private")}
            className={`p-1.5 rounded-lg bg-ink/60 transition-colors ${
              isPrivate
                ? "hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300"
                : "hover:bg-fog/20 text-fog hover:text-parchment"
            }`}
            title={isPrivate ? "Move to Public Repository" : "Move to Private Air-Gapped Vault"}
          >
            {isPrivate ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button
            onClick={navigateToCompare}
            className="p-1.5 rounded-lg bg-ink/60 hover:bg-cyan/20 text-fog hover:text-cyan transition-colors"
            title="Compare revisions"
          >
            <GitCompare size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInfo(file.name);
            }}
            className="p-1.5 rounded-lg bg-ink/60 hover:bg-indigo text-fog hover:text-parchment transition-colors"
            title="Inspect Metadata & Past Questions"
          >
            <Info size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.name);
            }}
            className="p-1.5 rounded-lg bg-ink/60 hover:bg-rust/20 text-fog hover:text-rust transition-colors"
            title="Delete Document"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function Library() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [selectedDocInfo, setSelectedDocInfo] = useState(null);
  const [docConversations, setDocConversations] = useState([]);
  const [isInfoLoading, setIsInfoLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const { privacyMode, setPrivacyMode } = useUI();

  const fileInputRef = useRef(null);

  const fetchDocuments = async (modeOverride = null) => {
    try {
      const targetMode = modeOverride || privacyMode;
      const res = await fetch(`${API_BASE}/documents?mode=${targetMode}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (e) {
      console.error("Failed to fetch documents", e);
    }
  };

  useEffect(() => {
    fetchDocuments(privacyMode);
  }, [privacyMode]);

  useEffect(() => {
    const handleUpdate = () => fetchDocuments(privacyMode);
    window.addEventListener("documentUpdated", handleUpdate);
    return () => window.removeEventListener("documentUpdated", handleUpdate);
  }, [privacyMode]);

  const handleInfo = async (name) => {
    setIsInfoLoading(true);
    setDocConversations([]);
    try {
      const res = await fetch(`${API_BASE}/documents?mode=${privacyMode}`);
      if (res.ok) {
        const data = await res.json();
        const found = data.find((d) => d.name === name);
        if (found) {
          setSelectedDocInfo(found);
          // Fetch past questions/conversations recorded for this document
          try {
            const convRes = await fetch(`${API_BASE}/documents/${encodeURIComponent(name)}/conversations`);
            if (convRes.ok) {
              const convData = await convRes.json();
              setDocConversations(convData);
            }
          } catch (cErr) {
            console.warn("Could not load document conversations", cErr);
          }
        } else {
          toast.error("Document details not found");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch document metadata");
    } finally {
      setIsInfoLoading(false);
    }
  };

  const handleTogglePrivacy = async (filename, newPrivacy) => {
    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}/privacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacy_mode: newPrivacy }),
      });
      if (res.ok) {
        toast.success(
          newPrivacy === "private"
            ? `🔒 "${filename}" moved to Private Vault`
            : `🌐 "${filename}" moved to Public Repository`
        );
        fetchDocuments(privacyMode);
        window.dispatchEvent(new Event("documentUpdated"));
      } else {
        toast.error("Failed to update document privacy mode");
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error updating privacy mode");
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Deleted ${filename}`);
        setFiles(files.filter((f) => f.name !== filename));
        window.dispatchEvent(new Event("documentUpdated"));
      } else {
        toast.error("Failed to delete document");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error while deleting");
    }
  };

  const processFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    setUploadProgress({ phase: "uploading", percent: 15 });

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Upload failed");
      }

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
                    detail: data.detail,
                  });
                } else if (data.type === "done") {
                  setUploadProgress(null);
                  toast.success(`Indexed ${data.filename} (${data.chunks_added} chunks) in ${privacyMode === "private" ? "Private Vault" : "Public Repository"}`);
                  fetchDocuments(privacyMode);
                  window.dispatchEvent(new Event("documentUpdated"));
                } else if (data.type === "error") {
                  setUploadProgress(null);
                  toast.error(data.message);
                }
              } catch (e) {
                console.error("Parse error", e);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setUploadProgress(null);
      toast.error(err.message || "Failed to upload document");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Filtered files
  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (typeFilter === "pdf") return f.type === ".pdf";
    if (typeFilter === "md") return f.type === ".md";
    return true;
  });

  const totalPages = files.reduce((acc, f) => acc + (f.pages || 0), 0);
  const totalChunks = files.reduce((acc, f) => acc + (f.chunks || 0), 0);
  const totalTables = files.reduce((acc, f) => acc + (f.tables || 0), 0);
  const totalQueries = files.reduce((acc, f) => acc + (f.total_queries || 0), 0);

  const isPrivate = privacyMode === "private";

  return (
    <div
      className="h-full p-6 sm:p-10 overflow-y-auto relative max-w-7xl mx-auto"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/90 backdrop-blur-md border-2 border-dashed border-brass rounded-2xl m-6 pointer-events-none">
          <div className="text-brass flex flex-col items-center gap-4">
            <UploadCloud size={64} className="animate-bounce" />
            <h2 className="font-hero text-2xl">Drop document to ingest</h2>
            <p className="font-ui-label text-sm text-fog">
              Ingesting to {isPrivate ? "Private Air-Gapped Vault" : "Public Knowledge Repository"}
            </p>
          </div>
        </div>
      )}

      {uploadProgress && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 glass-card px-5 py-2.5 rounded-full border border-brass/40 shadow-2xl flex items-center gap-3">
          <UploadCloud size={18} className="text-brass animate-pulse" />
          <span className="font-data-mono text-xs text-parchment">
            {uploadProgress.phase?.toUpperCase() || "PROCESSING"}: {Math.round(uploadProgress.percent)}%
          </span>
          {uploadProgress.detail && (
            <span className="text-xs text-fog font-ui-label">({uploadProgress.detail})</span>
          )}
        </div>
      )}

      {/* Atmospheric Ambient Glows */}
      <div className={`absolute top-0 right-1/4 w-[600px] h-[400px] rounded-full blur-[180px] pointer-events-none transition-colors duration-500 ${
        isPrivate ? "bg-emerald-500/[0.06]" : "bg-brass/[0.05]"
      }`} />
      <div className="absolute bottom-10 left-10 w-[500px] h-[400px] bg-parchment/[0.03] rounded-full blur-[180px] pointer-events-none" />

      {/* Mode Isolation Tabs Header */}
      <Reveal>
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-ink/70 p-2 sm:p-2.5 rounded-2xl border border-fog/15 backdrop-blur-xl">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setPrivacyMode("normal")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-ui-label transition-all cursor-pointer ${
                !isPrivate
                  ? "bg-brass text-white font-semibold shadow-lg shadow-brass/30"
                  : "text-fog hover:text-parchment hover:bg-ink/40"
              }`}
            >
              <Globe size={16} />
              <span>🌐 Public Repository</span>
              {!isPrivate && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                  {files.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setPrivacyMode("private")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-ui-label transition-all cursor-pointer ${
                isPrivate
                  ? "bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-600/30"
                  : "text-fog hover:text-parchment hover:bg-ink/40"
              }`}
            >
              <ShieldCheck size={16} />
              <span>🔒 Private Vault (Air-Gapped)</span>
              {isPrivate && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                  {files.length}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] font-data-mono text-fog px-2">
            Mode: <span className={isPrivate ? "text-emerald-400 font-bold" : "text-brass font-bold"}>
              {isPrivate ? "Air-Gapped Local" : "Public Multimodal"}
            </span>
          </div>
        </div>
      </Reveal>

      {/* Air-Gapped Mode Security Notice */}
      {isPrivate && (
        <Reveal>
          <div className="mb-6 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 flex items-start gap-3.5 shadow-xl">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="font-hero text-sm text-emerald-300 font-semibold mb-0.5">
                Isolated Private Document Vault Active
              </h4>
              <p className="font-ui-label text-xs text-emerald-300/80 leading-relaxed">
                Documents in this vault are strictly air-gapped. Public documents are completely excluded from indexing, vector search, and Ollama LLM context. No questions or chunks leave your local device.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/* Main Header */}
      <Reveal>
        <header className="mb-8 flex flex-col sm:flex-row justify-between sm:items-end gap-4 pb-6 border-b border-fog/10 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-data-mono border uppercase tracking-widest ${
                isPrivate
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-brass/15 text-brass border-brass/30"
              }`}>
                {isPrivate ? "Air-Gapped Vault" : "Knowledge Repository"}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl text-parchment font-semibold tracking-tight">
              {isPrivate ? "Private Document" : "Engineering Document"}{" "}
              <span className={`font-serif italic font-normal ${isPrivate ? "text-emerald-400" : "text-[#e10600]"}`}>
                {isPrivate ? "Vault" : "Library"}
              </span>
            </h1>
            <p className="font-body text-fog text-sm sm:text-base max-w-xl mt-1 leading-relaxed">
              {isPrivate
                ? "Confidential blueprints and air-gapped documents processed locally with table and coordinate extraction."
                : "Multimodal document indexing with table preservation, page coordinate mapping, and past conversation memory."}
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-ui-label text-white shadow-lg cursor-pointer self-start sm:self-auto hover:scale-[1.02] active:scale-[0.98] transition-all ${
              isPrivate
                ? "bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-500"
                : "btn-signal shadow-brass/25"
            }`}
          >
            <Plus size={18} />
            <span>Add {isPrivate ? "Private" : "Public"} Document</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                processFile(e.target.files[0]);
              }
            }}
            accept=".pdf,.md,.txt,.csv,.jpg,.jpeg,.png,.webp"
            className="hidden"
          />
        </header>
      </Reveal>

      {/* Metrics Banner */}
      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-8 relative z-10">
          {[
            { label: isPrivate ? "Private Docs" : "Total Documents", value: files.length, icon: Database, color: isPrivate ? "text-emerald-400" : "text-[#e10600]" },
            { label: "Total Pages", value: totalPages, icon: FileText, color: "text-[#c0c0c0]" },
            { label: "Vector Chunks", value: totalChunks, icon: Layers, color: "text-[#c0c0c0]" },
            { label: "Questions Asked", value: totalQueries, icon: MessageSquare, color: isPrivate ? "text-emerald-400" : "text-[#e10600]" },
          ].map((stat, i) => {
            const IconC = stat.icon;
            return (
              <div key={i} className="holo-card p-4 rounded-xl glass-card flex items-center justify-between border border-fog/15 hover:border-brass/40 transition-all duration-300">
                <div>
                  <div className="font-data-mono text-2xl font-bold text-parchment">
                    <CountUp value={stat.value} />
                  </div>
                  <div className="font-ui-label text-xs text-fog uppercase tracking-wider mt-0.5">
                    {stat.label}
                  </div>
                </div>
                <div className={`p-2.5 rounded-xl bg-ink/70 border border-fog/15 ${stat.color} shadow-sm`}>
                  <IconC size={20} />
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fog" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name..."
            className="w-full bg-indigo/30 border border-fog/20 rounded-xl pl-10 pr-4 py-2 text-xs font-ui-label text-parchment placeholder:text-fog/70 focus:outline-none focus:border-brass transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {[
            { id: "all", label: "All Formats" },
            { id: "pdf", label: "PDFs" },
            { id: "md", label: "Markdown" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-ui-label transition-colors cursor-pointer ${
                typeFilter === tab.id
                  ? isPrivate
                    ? "bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-600/25"
                    : "bg-brass text-white font-semibold shadow-md shadow-brass/25"
                  : "bg-indigo/30 text-fog hover:text-parchment border border-fog/15"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        <AnimatePresence>
          {filteredFiles.map((file) => (
            <FileCard
              key={file.name}
              file={file}
              onDelete={handleDelete}
              onInfo={handleInfo}
              onTogglePrivacy={handleTogglePrivacy}
              activeMode={privacyMode}
            />
          ))}
        </AnimatePresence>

        {/* Dropzone Card */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="suggestion-card p-5 rounded-2xl border-2 border-dashed border-fog/20 hover:border-brass/50 bg-indigo/15 hover:bg-indigo/30 transition-all flex flex-col items-center justify-center text-center h-64 cursor-pointer group"
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${
            isPrivate ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-brass/10 border border-brass/20 text-brass"
          }`}>
            <UploadCloud size={24} />
          </div>
          <span className="font-ui font-semibold text-sm text-parchment mb-1 group-hover:text-brass transition-colors">
            Upload to {isPrivate ? "Private Vault" : "Public Library"}
          </span>
          <span className="font-ui-label text-xs text-fog max-w-[20ch]">
            Drop files here or click to browse
          </span>
          <div className="mt-3 flex gap-1 text-[10px] font-data-mono text-fog/70">
            <span>PDF</span> &middot; <span>MD</span> &middot; <span>CSV</span> &middot; <span>IMG</span>
          </div>
        </div>
      </div>

      {/* Empty State for Private Vault */}
      {isPrivate && filteredFiles.length === 0 && (
        <div className="mt-8 text-center py-12 px-4 rounded-2xl border border-fog/10 bg-indigo/20">
          <ShieldCheck size={40} className="mx-auto text-emerald-400 mb-3" />
          <h3 className="font-hero text-lg text-parchment mb-1">Your Private Vault is Empty</h3>
          <p className="font-ui-label text-xs text-fog max-w-md mx-auto mb-4">
            No confidential documents are stored here yet. Upload documents or move documents from the Public Repository using the lock icon on any document card.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-ui-label text-xs font-semibold cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
          >
            Upload Air-Gapped Document
          </button>
        </div>
      )}

      {/* Document Info & Conversation History Modal */}
      <AnimatePresence>
        {selectedDocInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-md p-4"
            onClick={() => setSelectedDocInfo(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-indigo border border-brass/30 p-6 sm:p-8 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedDocInfo(null)}
                className="absolute top-5 right-5 text-fog hover:text-brass transition-colors cursor-pointer"
              >
                <X size={22} />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-data-mono bg-brass/15 text-brass border border-brass/30">
                  Document Intelligence Inspector
                </span>
                {selectedDocInfo.privacy_mode === "private" ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-data-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Lock size={10} /> Private Mode
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-data-mono bg-ink/50 text-fog border border-fog/20 flex items-center gap-1">
                    <Globe size={10} /> Public Mode
                  </span>
                )}
              </div>

              <h2 className="font-hero text-2xl text-parchment mb-6 pr-8 truncate" title={selectedDocInfo.name}>
                {selectedDocInfo.name}
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
                <div className="bg-ink/50 p-3.5 rounded-xl border border-fog/10 flex flex-col items-center justify-center">
                  <span className="font-data-mono text-xl font-bold text-brass">{selectedDocInfo.pages || 0}</span>
                  <span className="font-ui-label text-[10px] text-fog uppercase tracking-wider mt-1">Pages</span>
                </div>
                <div className="bg-ink/50 p-3.5 rounded-xl border border-fog/10 flex flex-col items-center justify-center">
                  <span className="font-data-mono text-xl font-bold text-parchment">{selectedDocInfo.chunks || 0}</span>
                  <span className="font-ui-label text-[10px] text-fog uppercase tracking-wider mt-1">Chunks</span>
                </div>
                <div className="bg-ink/50 p-3.5 rounded-xl border border-fog/10 flex flex-col items-center justify-center">
                  <span className="font-data-mono text-xl font-bold text-cyan">{selectedDocInfo.tables || 0}</span>
                  <span className="font-ui-label text-[10px] text-fog uppercase tracking-wider mt-1">Tables</span>
                </div>
                <div className="bg-ink/50 p-3.5 rounded-xl border border-fog/10 flex flex-col items-center justify-center">
                  <span className="font-data-mono text-xl font-bold text-moss">{selectedDocInfo.figures || 0}</span>
                  <span className="font-ui-label text-[10px] text-fog uppercase tracking-wider mt-1">Figures</span>
                </div>
              </div>

              {/* Past Inquiries & Questions Section */}
              <div className="mb-6 p-4 rounded-xl bg-ink/60 border border-fog/15">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-brass" />
                    <h3 className="font-ui font-semibold text-sm text-parchment">
                      Past Questions & Conversation Memory
                    </h3>
                  </div>
                  <span className="font-data-mono text-xs text-brass">
                    {selectedDocInfo.total_queries || 0} query(s) recorded
                  </span>
                </div>

                {docConversations && docConversations.length > 0 && docConversations[0]?.messages?.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {docConversations[0].messages
                      .filter((m) => m.role === "user")
                      .map((m, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-indigo/40 border border-fog/10 text-xs text-parchment flex items-start gap-2"
                        >
                          <span className="text-brass font-bold">Q{idx + 1}:</span>
                          <span className="line-clamp-2">{m.content}</span>
                        </div>
                      ))}
                  </div>
                ) : selectedDocInfo.last_query ? (
                  <div className="p-2.5 rounded-lg bg-indigo/40 border border-fog/10 text-xs text-parchment flex items-start gap-2">
                    <span className="text-brass font-bold">Latest:</span>
                    <span>"{selectedDocInfo.last_query}"</span>
                  </div>
                ) : (
                  <p className="text-xs text-fog italic py-2">
                    No questions have been asked for this document yet. Click below to start inquiring.
                  </p>
                )}
              </div>

              <div className="space-y-2.5 bg-ink/40 p-4 rounded-xl border border-fog/10 text-xs font-data-mono text-fog">
                <div className="flex justify-between">
                  <span>File Size:</span>
                  <span className="text-parchment">{formatBytes(selectedDocInfo.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Multimodal Status:</span>
                  <span className="text-brass">
                    {selectedDocInfo.multimodal_ready ? "Ready (Page-Aware Extracted)" : "Standard Text"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Privacy Tier:</span>
                  <span className={selectedDocInfo.privacy_mode === "private" ? "text-emerald-400" : "text-parchment"}>
                    {selectedDocInfo.privacy_mode === "private" ? "Air-Gapped Private Vault" : "Public Knowledge Repository"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Uploaded At:</span>
                  <span className="text-parchment">
                    {selectedDocInfo.uploaded_at ? new Date(selectedDocInfo.uploaded_at).toLocaleString() : "Pre-indexed"}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-between items-center gap-3">
                <button
                  onClick={() => {
                    handleTogglePrivacy(
                      selectedDocInfo.name,
                      selectedDocInfo.privacy_mode === "private" ? "normal" : "private"
                    );
                    setSelectedDocInfo((prev) => ({
                      ...prev,
                      privacy_mode: prev.privacy_mode === "private" ? "normal" : "private",
                    }));
                  }}
                  className="px-4 py-2 rounded-xl border border-fog/20 text-fog hover:text-parchment text-xs font-ui-label cursor-pointer transition-colors"
                >
                  {selectedDocInfo.privacy_mode === "private" ? "Move to Public" : "Move to Private"}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedDocInfo(null)}
                    className="px-4 py-2 rounded-xl text-fog hover:text-parchment text-xs font-ui-label cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      const docName = selectedDocInfo.name;
                      const mode = selectedDocInfo.privacy_mode || privacyMode;
                      setSelectedDocInfo(null);
                      openDocumentChat(docName, mode);
                    }}
                    className="btn-signal px-5 py-2 text-white font-semibold rounded-xl text-xs font-ui-label transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <MessageSquare size={14} />
                    <span>Open Past Conversation</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
