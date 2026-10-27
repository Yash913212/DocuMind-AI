import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  GitCompare,
  AlertTriangle,
  FileText,
  Hash,
  Table as TableIcon,
  Tag,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useUI } from "../context/UIContext";
import { API_BASE } from "../config";

export function Compare() {
  const { openInspector } = useUI();
  const [documents, setDocuments] = useState([]);
  const [docA, setDocA] = useState("");
  const [docB, setDocB] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (data.length >= 2) {
          setDocA(data[0].name);
          setDocB(data[1].name);
        } else if (data.length === 1) {
          setDocA(data[0].name);
          setDocB(data[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch documents for comparison", err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleCompare = async () => {
    if (!docA || !docB) {
      setError("Please select two documents to compare.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_a: docA, doc_b: docB }),
      });

      if (!res.ok) {
        throw new Error(`Comparison failed with status ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to compare document revisions.");
    } finally {
      setLoading(false);
    }
  };

  const filteredChanges = result?.changes
    ? result.changes.filter((c) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "critical") return c.severity === "critical";
        return c.category === activeFilter;
      })
    : [];

  const getCategoryIcon = (category) => {
    switch (category) {
      case "value":
        return <Hash size={16} className="text-[#e10600]" />;
      case "warning":
        return <AlertTriangle size={16} className="text-[#e10600]" />;
      case "table":
        return <TableIcon size={16} className="text-[#c0c0c0]" />;
      case "label":
        return <Tag size={16} className="text-[#c0c0c0]" />;
      default:
        return <FileText size={16} className="text-parchment" />;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "critical":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-data-mono uppercase tracking-wider bg-[#e10600]/20 text-[#e10600] border border-[#e10600]/40 font-semibold shadow-[0_0_12px_rgba(225,6,0,0.25)]">
            Critical
          </span>
        );
      case "warning":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-data-mono uppercase tracking-wider bg-[#c0c0c0]/15 text-[#c0c0c0] border border-[#c0c0c0]/30 font-medium">
            Warning
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-data-mono uppercase tracking-wider bg-ink/60 text-fog border border-fog/20">
            Info
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col py-4 sm:py-8 px-4 sm:px-8 relative w-full overflow-y-auto">
      {/* Cinematic Ambient Atmosphere */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-brass/[0.06] rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[400px] bg-parchment/[0.03] rounded-full blur-[180px] pointer-events-none" />

      <header className="mb-6 shrink-0 max-w-5xl mx-auto w-full relative z-10">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="p-2 rounded-xl bg-gradient-to-br from-brass/30 to-indigo border border-brass/50 text-brass shadow-lg shadow-brass/20">
              <GitCompare size={20} />
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-data-mono uppercase tracking-widest bg-brass/15 text-brass border border-brass/30">
              Revision Comparator
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl text-parchment tracking-tight font-semibold">
            Document Version <span className="font-serif italic font-normal text-[#e10600]">Comparison</span>
          </h1>
          <p className="font-body text-fog text-sm sm:text-base max-w-2xl mt-1.5 leading-relaxed">
            Compare two revisions of technical manuals to identify numerical drift,
            safety warnings, and table changes with coordinate-level citations.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full space-y-6 pb-12 relative z-10">
        {/* Document Selection Card */}
        <div className="bg-indigo/30 p-5 rounded-2xl border border-brass/20 shadow-xl backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Revision A */}
            <div className="space-y-2">
              <label className="block font-ui-label text-xs uppercase tracking-wider text-fog">
                Revision A (Baseline / Older)
              </label>
              {documents.length > 0 ? (
                <select
                  value={docA}
                  onChange={(e) => setDocA(e.target.value)}
                  className="w-full bg-ink border border-fog/20 rounded-xl px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-brass transition-colors"
                >
                  {documents.map((d) => (
                    <option key={`a-${d.name}`} value={d.name}>
                      {d.name} ({d.chunks} chunks)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g., Manual_Rev_A.pdf"
                  value={docA}
                  onChange={(e) => setDocA(e.target.value)}
                  className="w-full bg-ink border border-fog/20 rounded-xl px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-brass"
                />
              )}
            </div>

            {/* Revision B */}
            <div className="space-y-2">
              <label className="block font-ui-label text-xs uppercase tracking-wider text-fog">
                Revision B (Target / Newer)
              </label>
              {documents.length > 0 ? (
                <select
                  value={docB}
                  onChange={(e) => setDocB(e.target.value)}
                  className="w-full bg-ink border border-fog/20 rounded-xl px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-brass transition-colors"
                >
                  {documents.map((d) => (
                    <option key={`b-${d.name}`} value={d.name}>
                      {d.name} ({d.chunks} chunks)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g., Manual_Rev_B.pdf"
                  value={docB}
                  onChange={(e) => setDocB(e.target.value)}
                  className="w-full bg-ink border border-fog/20 rounded-xl px-4 py-2.5 text-sm text-parchment focus:outline-none focus:border-brass"
                />
              )}
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={handleCompare}
              disabled={loading || !docA || !docB}
              className={`px-6 py-2.5 rounded-xl font-ui-label text-sm uppercase tracking-wider flex items-center gap-2 transition-all shadow-md ${
                loading
                  ? "bg-fog/20 text-fog cursor-not-allowed"
                  : "btn-signal text-white hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Analyzing Differences...
                </>
              ) : (
                <>
                  <GitCompare size={16} />
                  Compare Revisions
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rust/20 border border-rust/40 text-rust flex items-center gap-3">
            <ShieldAlert size={20} />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Comparison Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary Banner */}
            <div className="bg-indigo/40 p-5 rounded-2xl border border-brass/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fog/10 pb-3">
                <span className="font-ui-label text-xs uppercase tracking-widest text-brass">
                  Engineering Change Summary
                </span>
                <span className="font-data-mono text-xs text-fog">
                  {result.aligned_sections} Aligned Sections Analyzed
                </span>
              </div>
              <p className="text-sm sm:text-base text-parchment/90 leading-relaxed">
                {result.summary}
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                { id: "all", label: `All Changes (${result.changes?.length || 0})` },
                {
                  id: "critical",
                  label: `Critical (${
                    result.changes?.filter((c) => c.severity === "critical").length || 0
                  })`,
                },
                {
                  id: "value",
                  label: `Values (${
                    result.changes?.filter((c) => c.category === "value").length || 0
                  })`,
                },
                {
                  id: "warning",
                  label: `Warnings (${
                    result.changes?.filter((c) => c.category === "warning").length || 0
                  })`,
                },
                {
                  id: "table",
                  label: `Tables (${
                    result.changes?.filter((c) => c.category === "table").length || 0
                  })`,
                },
                {
                  id: "label",
                  label: `Labels (${
                    result.changes?.filter((c) => c.category === "label").length || 0
                  })`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-ui-label text-xs transition-all ${
                    activeFilter === tab.id
                      ? "btn-signal text-white font-semibold shadow-md shadow-brass/30 scale-[1.02]"
                      : "bg-indigo text-fog hover:text-parchment border border-fog/15 hover:border-fog/30"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Change Items List */}
            <div className="space-y-3.5">
              {filteredChanges.length > 0 ? (
                filteredChanges.map((change, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 rounded-2xl bg-indigo/85 border border-fog/15 hover:border-brass/50 transition-all duration-300 shadow-lg hover:shadow-[0_12px_36px_-10px_rgba(225,6,0,0.18)] space-y-3.5 backdrop-blur-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-ink/60 border border-fog/15">
                          {getCategoryIcon(change.category)}
                        </div>
                        <span className="font-ui text-base text-parchment font-semibold">
                          {change.item}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(change.severity)}
                      </div>
                    </div>

                    {/* Old vs New Value Diff Box */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                      {/* Old Value */}
                      <div className="p-3.5 rounded-xl bg-[#e10600]/8 border border-[#e10600]/25 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-ui-label uppercase tracking-wider text-[#e10600]">
                          <span className="font-semibold">Revision A (Baseline)</span>
                          {change.page_old && (
                            <button
                              onClick={() =>
                                openInspector(
                                  `## Revision A Reference\n\n**Document:** ${result.doc_a}\n**Page:** ${change.page_old}\n\n**Item:** ${change.item}\n\n**Value:** ${change.old_value || "N/A"}\n\n${change.details || ""}`
                                )
                              }
                              className="hover:underline flex items-center gap-0.5 text-fog hover:text-[#e10600] transition-colors"
                            >
                              Page {change.page_old} <ExternalLink size={10} />
                            </button>
                          )}
                        </div>
                        <div className="font-data-mono text-sm text-parchment/70 line-through decoration-[#e10600]/80 break-words">
                          {change.old_value || "— Not Specified —"}
                        </div>
                      </div>

                      {/* New Value */}
                      <div className="p-3.5 rounded-xl bg-ink/70 border border-fog/20 space-y-1.5 shadow-inner">
                        <div className="flex items-center justify-between text-[11px] font-ui-label uppercase tracking-wider text-[#c0c0c0]">
                          <span className="flex items-center gap-1 font-semibold text-parchment">
                            <ArrowRight size={12} className="text-[#e10600]" /> Revision B (Updated)
                          </span>
                          {change.page_new && (
                            <button
                              onClick={() =>
                                openInspector(
                                  `## Revision B Reference\n\n**Document:** ${result.doc_b}\n**Page:** ${change.page_new}\n\n**Item:** ${change.item}\n\n**Value:** ${change.new_value || "N/A"}\n\n${change.details || ""}`
                                )
                              }
                              className="hover:underline flex items-center gap-0.5 text-fog hover:text-parchment transition-colors"
                            >
                              Page {change.page_new} <ExternalLink size={10} />
                            </button>
                          )}
                        </div>
                        <div className="font-data-mono text-sm text-parchment font-semibold break-words">
                          {change.new_value || "— Removed / N/A —"}
                        </div>
                      </div>
                    </div>

                    {/* Change Details */}
                    {change.details && (
                      <p className="text-xs text-fog leading-relaxed pt-1 border-t border-fog/10">
                        {change.details}
                      </p>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="p-8 text-center text-fog rounded-2xl bg-ink/30 border border-fog/10">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-moss" />
                  <p className="text-sm">No changes match the selected filter category.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
