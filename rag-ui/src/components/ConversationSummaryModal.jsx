import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  Download,
  Sparkles,
  Layers,
  Database,
  FileText,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Cpu,
  BarChart3,
  BookmarkCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { API_BASE } from "../config";
import { generateAllSessionsSummary } from "../utils/chatSessionStore";

export function ConversationSummaryModal({
  isOpen,
  onClose,
  sessions = [],
  onSelectSession,
}) {
  const [activeTab, setActiveTab] = useState("synthesis"); // 'synthesis' | 'sessions' | 'sources'
  const [copied, setCopied] = useState(false);
  const [isAiSynthesizing, setIsAiSynthesizing] = useState(false);
  const [aiDeepSynthesis, setAiDeepSynthesis] = useState("");

  // Compute structured multi-session summary
  const summaryData = useMemo(() => {
    return generateAllSessionsSummary(sessions);
  }, [sessions]);

  // Reset AI synthesis if modal reopens
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const textToCopy = aiDeepSynthesis
      ? `${summaryData.markdownReport}\n\n## 6. DocuMind Deep AI Synthesis\n${aiDeepSynthesis}`
      : summaryData.markdownReport;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success("Executive summary copied to clipboard!", { id: "copy-summary" });
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownload = () => {
    const textContent = aiDeepSynthesis
      ? `${summaryData.markdownReport}\n\n## 6. DocuMind Deep AI Synthesis\n${aiDeepSynthesis}`
      : summaryData.markdownReport;

    const blob = new Blob([textContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DocuMind_Intelligence_Briefing_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Briefing exported as Markdown (.md)", { id: "export-summary" });
  };

  const handleDeepAiSynthesize = async () => {
    if (summaryData.totalSessions === 0) {
      toast.error("No conversation history available to synthesize.");
      return;
    }

    setIsAiSynthesizing(true);
    setAiDeepSynthesis("");
    setActiveTab("synthesis");

    try {
      // Build condensed transcript of all sessions
      const transcript = sessions
        .filter((s) => s.messages && s.messages.length > 0)
        .map((s, idx) => {
          const userQueries = s.messages
            .filter((m) => m.role === "user")
            .map((m) => `User: ${m.content}`)
            .join("\n");
          const assistantHighlights = s.messages
            .filter((m) => m.role === "assistant")
            .map((m) => `Assistant: ${m.content.slice(0, 180)}...`)
            .join("\n");
          return `### Session ${idx + 1}: ${s.title}\nScope: ${s.document || "All"}\n${userQueries}\n${assistantHighlights}`;
        })
        .join("\n\n");

      const prompt = `Synthesize a comprehensive executive briefing from the following user conversation history with DocuMind AI:\n\n${transcript}\n\nHighlight:\n1. Core engineering themes & user intents\n2. Key numerical tolerances & technical specifications extracted\n3. Cross-document findings & technical conclusions\n4. Recommended next engineering investigations`;

      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: prompt,
          history: [],
          document: null,
          technical_mode: true,
        }),
      });

      if (!response.ok) throw new Error("AI Synthesis request failed");

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
                if (data.type === "content") {
                  setAiDeepSynthesis((prev) => prev + data.token);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
      toast.success("AI Synthesis complete!", { id: "ai-synth-done" });
    } catch (err) {
      console.error(err);
      toast.error("Deep AI synthesis failed. Displaying local analytical briefing.");
    } finally {
      setIsAiSynthesizing(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-ink/80 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#272727] text-parchment rounded-2xl border border-fog/20 shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-fog/15 bg-indigo/40 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brass/15 border border-brass/35 flex items-center justify-center text-brass shadow-sm">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-hero text-lg sm:text-xl text-parchment font-semibold leading-tight">
                    Executive Conversation Synthesis
                  </h2>
                  <span className="text-[10px] font-data-mono px-2 py-0.5 rounded-full bg-brass/15 text-brass border border-brass/30">
                    All History
                  </span>
                </div>
                <p className="font-ui-label text-xs text-fog mt-0.5">
                  Consolidated technical analysis across {summaryData.totalSessions} conversation session(s)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="h-8 px-3 rounded-lg bg-ink/60 hover:bg-ink border border-fog/20 text-xs font-ui-label text-fog hover:text-parchment flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy Full Summary"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                onClick={handleDownload}
                className="h-8 px-3 rounded-lg bg-ink/60 hover:bg-ink border border-fog/20 text-xs font-ui-label text-fog hover:text-parchment flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Markdown Report"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export .md</span>
              </button>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-ink/60 hover:bg-ink border border-fog/20 flex items-center justify-center text-fog hover:text-parchment transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 border-b border-fog/10 bg-ink/40 shrink-0">
            <motion.div 
              whileHover={{ y: -2, scale: 1.015 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-card p-3 rounded-xl border border-fog/15 flex flex-col cursor-default"
            >
              <span className="text-[10px] font-ui-label uppercase text-fog tracking-wider">Sessions</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-data-mono text-xl font-bold text-parchment">
                  {summaryData.totalSessions}
                </span>
                <span className="text-[11px] text-fog font-ui">logged</span>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -2, scale: 1.015 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-card p-3 rounded-xl border border-fog/15 flex flex-col cursor-default"
            >
              <span className="text-[10px] font-ui-label uppercase text-fog tracking-wider">Inquiries</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-data-mono text-xl font-bold text-brass">
                  {summaryData.totalUserQueries}
                </span>
                <span className="text-[11px] text-fog font-ui">prompts</span>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -2, scale: 1.015 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-card p-3 rounded-xl border border-fog/15 flex flex-col cursor-default"
            >
              <span className="text-[10px] font-ui-label uppercase text-fog tracking-wider">Grounded Docs</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-data-mono text-xl font-bold text-parchment">
                  {summaryData.uniqueDocs.length}
                </span>
                <span className="text-[11px] text-fog font-ui">manuals</span>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -2, scale: 1.015 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-card p-3 rounded-xl border border-fog/15 flex flex-col cursor-default"
            >
              <span className="text-[10px] font-ui-label uppercase text-fog tracking-wider">Specs & Tolerances</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-data-mono text-xl font-bold text-parchment">
                  {summaryData.extractedSpecs.length}
                </span>
                <span className="text-[11px] text-fog font-ui">verified</span>
              </div>
            </motion.div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-ink/60 border-b border-fog/10 shrink-0">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-ink/70 border border-fog/15 relative">
              {[
                { id: "synthesis", label: "Synthesized Briefing" },
                { id: "sessions", label: `Session Log (${summaryData.sessionsList.length})` },
                { id: "sources", label: `Cited Manuals (${summaryData.uniqueDocs.length})` },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-ui-label font-medium transition-colors cursor-pointer z-10 ${
                      isActive ? "text-white font-semibold" : "text-fog hover:text-parchment"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeSummaryTabIndicator"
                        className="absolute inset-0 rounded-lg bg-brass shadow-sm shadow-brass/30"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Deep AI Synthesizer Action */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleDeepAiSynthesize}
              disabled={isAiSynthesizing || summaryData.totalSessions === 0}
              className="h-8 px-3 rounded-lg bg-brass/15 hover:bg-brass text-brass hover:text-white border border-brass/40 text-xs font-ui-label font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              title="Run a real LLM synthesis across all past conversations"
            >
              <RefreshCw size={13} className={isAiSynthesizing ? "animate-spin" : ""} />
              <span>{isAiSynthesizing ? "Synthesizing..." : "Deep AI Synthesis"}</span>
            </motion.button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {summaryData.totalSessions === 0 ? (
              <div className="py-16 text-center text-fog flex flex-col items-center">
                <Clock size={40} className="text-fog/40 mb-3" />
                <h3 className="font-hero text-lg text-parchment mb-1">No Past Conversations Yet</h3>
                <p className="font-body text-xs max-w-sm text-fog">
                  Start conversations in DocuMind AI to automatically record technical inquiries, specs, and page citations here.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {/* TAB 1: EXECUTIVE SYNTHESIS */}
                {activeTab === "synthesis" && (
                  <motion.div 
                    key="tab-synthesis"
                    initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-6"
                  >
                    {/* Live Deep AI Synthesis Box if active or present */}
                    {isAiSynthesizing && (
                      <div className="p-4 rounded-xl bg-brass/10 border border-brass/40 flex items-center gap-3">
                        <RefreshCw size={18} className="text-brass animate-spin shrink-0" />
                        <div>
                          <div className="font-ui-label text-xs font-semibold text-brass">
                            DocuMind AI Generating Cross-Conversation Synthesis...
                          </div>
                          <div className="font-body text-[11px] text-fog">
                            Extracting technical parameters, cross-session patterns, and document correlations.
                          </div>
                        </div>
                      </div>
                    )}

                    {aiDeepSynthesis && (
                      <div className="p-5 rounded-xl bg-indigo/40 border border-brass/35 shadow-md">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-brass/25">
                          <Cpu size={16} className="text-brass" />
                          <h3 className="font-hero text-sm font-semibold text-brass tracking-wide uppercase">
                            DocuMind LLM Deep Synthesis
                          </h3>
                        </div>
                        <div className="markdown-body font-body text-sm leading-relaxed text-parchment">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiDeepSynthesis}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Extracted Tolerances Chips */}
                    {summaryData.extractedSpecs.length > 0 && (
                      <div className="p-4 rounded-xl bg-ink/50 border border-fog/15">
                        <div className="flex items-center gap-2 mb-2.5">
                          <BookmarkCheck size={15} className="text-brass" />
                          <span className="font-ui-label text-xs font-semibold text-parchment">
                            Extracted Engineering Specifications & Tolerances
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {summaryData.extractedSpecs.map((spec, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-md bg-indigo text-parchment border border-brass/30 text-xs font-data-mono font-medium"
                            >
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Standard Analytical Synthesis Markdown */}
                    <div className="p-5 rounded-xl bg-ink/40 border border-fog/15 markdown-body font-body text-sm leading-relaxed text-parchment">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1 className="text-xl font-hero text-brass mb-3 mt-4" {...props} />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 className="text-lg font-hero text-brass mb-2.5 mt-5 border-b border-fog/15 pb-1" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="text-sm font-hero text-parchment mb-2 mt-4 font-semibold" {...props} />
                          ),
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto my-3">
                              <table className="w-full text-left text-xs border-collapse" {...props} />
                            </div>
                          ),
                          th: ({ node, ...props }) => (
                            <th className="border-b border-fog/30 p-2 font-ui-label text-brass bg-indigo/30" {...props} />
                          ),
                          td: ({ node, ...props }) => (
                            <td className="border-b border-fog/10 p-2 font-data-mono" {...props} />
                          ),
                          code: ({ node, inline, ...props }) => (
                            <code className="bg-ink/70 text-brass px-1.5 py-0.5 rounded text-xs font-data-mono" {...props} />
                          ),
                        }}
                      >
                        {summaryData.markdownReport}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: DETAILED SESSIONS LOG */}
                {activeTab === "sessions" && (
                  <motion.div
                    key="tab-sessions"
                    initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-4"
                  >
                    {summaryData.sessionsList.map((session) => (
                      <motion.div
                        key={session.id}
                        whileHover={{ y: -1.5, scale: 1.008 }}
                        transition={{ duration: 0.2 }}
                        className="p-4 rounded-xl bg-ink/50 border border-fog/15 hover:border-brass/40 transition-all flex flex-col gap-2.5 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-brass/15 text-brass flex items-center justify-center font-data-mono text-xs font-bold">
                              #{session.index}
                            </span>
                            <h4 className="font-ui font-semibold text-sm text-parchment group-hover:text-brass transition-colors">
                              {session.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-data-mono text-fog bg-indigo/50 px-2 py-0.5 rounded border border-fog/15">
                              {session.date}
                            </span>
                            {onSelectSession && (
                              <button
                                onClick={() => {
                                  onSelectSession(session.id);
                                  onClose();
                                }}
                                className="h-7 px-2 rounded-lg bg-brass/15 hover:bg-brass text-brass hover:text-white text-xs font-ui-label flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <span>Open</span>
                                <ArrowRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="text-xs font-body text-fog/90 pl-8">
                          <div className="mb-1">
                            <strong className="text-parchment">Scope:</strong>{" "}
                            <span className="font-data-mono text-brass">{session.document}</span> &middot;{" "}
                            <span>{session.queryCount} user query(s)</span>
                          </div>
                          <div className="mb-1">
                            <strong className="text-parchment">Primary Query:</strong>{" "}
                            <span className="italic text-parchment/90">"{session.primaryInquiry}"</span>
                          </div>
                          <div>
                            <strong className="text-parchment">Key Finding:</strong>{" "}
                            <span className="text-fog">{session.keyInsight}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {/* TAB 3: CITED MANUALS & REVISIONS */}
                {activeTab === "sources" && (
                  <motion.div
                    key="tab-sources"
                    initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-4"
                  >
                    {summaryData.uniqueDocs.length === 0 ? (
                      <div className="p-8 text-center text-fog text-xs">
                        No specific document citations recorded in the current sessions.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {summaryData.uniqueDocs.map((doc, idx) => (
                          <motion.div
                            key={idx}
                            whileHover={{ y: -2, scale: 1.01 }}
                            transition={{ duration: 0.2 }}
                            className="p-4 rounded-xl bg-ink/50 border border-fog/15 hover:border-brass/30 transition-all flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <FileText size={16} className="text-brass shrink-0" />
                                <h4 className="font-ui font-semibold text-sm text-parchment truncate" title={doc.name}>
                                  {doc.name}
                                </h4>
                              </div>
                              <div className="space-y-1 text-xs font-body text-fog">
                                <div>
                                  <strong className="text-parchment">Citations:</strong>{" "}
                                  <span className="font-data-mono text-brass">{doc.citationCount}</span> page reference(s)
                                </div>
                                {doc.pages.length > 0 && (
                                  <div>
                                    <strong className="text-parchment">Referenced Pages:</strong>{" "}
                                    <span className="font-data-mono text-fog">
                                      {doc.pages.join(", ")}
                                    </span>
                                  </div>
                                )}
                                {doc.types.length > 0 && (
                                  <div>
                                    <strong className="text-parchment">Element Types:</strong>{" "}
                                    <span className="font-data-mono text-fog">
                                      {doc.types.join(", ")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3 border-t border-fog/15 bg-indigo/30 flex items-center justify-between text-xs font-ui-label text-fog shrink-0">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-brass" />
              <span>DocuMind Verified History Synthesis &middot; Offline Storage</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-ink/80 hover:bg-ink text-parchment border border-fog/20 transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
