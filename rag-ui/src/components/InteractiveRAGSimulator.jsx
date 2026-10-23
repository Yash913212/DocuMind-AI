import React, { useEffect, useState } from "react";
import {
  Search,
  FileText,
  Database,
  ArrowRight,
  RefreshCw,
  Crosshair,
  Layers,
  ShieldAlert,
  CheckCircle2,
  Table as TableIcon,
  Image as ImageIcon,
} from "lucide-react";
import { API_BASE } from "../config";

const TYPE_META = {
  text: { label: "Text", icon: FileText, color: "text-[#c0c0c0]" },
  table: { label: "Table", icon: TableIcon, color: "text-[#e10600]" },
  figure: { label: "Figure", icon: ImageIcon, color: "text-[#c0c0c0]" },
  visual_page: { label: "Visual page", icon: ImageIcon, color: "text-[#c0c0c0]" },
  image: { label: "Image", icon: ImageIcon, color: "text-[#e10600]" },
};

export function InteractiveRAGSimulator({ onLaunchChat }) {
  const [documents, setDocuments] = useState([]);
  const [documentFilter, setDocumentFilter] = useState("ALL");
  const [query, setQuery] = useState("What are the key specifications?");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/documents`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setDocuments(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const runRetrieval = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setHasRun(true);
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        throw new Error(`Retrieval failed with status ${res.status}`);
      }
      const data = await res.json();
      const filtered =
        documentFilter === "ALL"
          ? data
          : data.filter((item) => item.source === documentFilter);
      setResults(filtered);
      setSelected(filtered[0] || null);
    } catch (err) {
      setError(err.message || "Unable to run retrieval.");
      setResults([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-3xl bg-indigo/90 border border-fog/20 shadow-2xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-2xl">
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-brass/[0.08] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-parchment/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-fog/15 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brass opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brass" />
            </span>
            <span className="text-[11px] font-data-mono uppercase tracking-widest text-brass">
              Live Retrieval Sandbox
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl text-parchment font-semibold tracking-tight">
            Query Your <span className="font-serif italic font-normal text-[#e10600]">Indexed Documents</span>
          </h3>
          <p className="text-xs text-fog font-body mt-1">
            Runs the same vector retrieval used by DocuMind AI chat. Results are real chunks from
            your library.
          </p>
        </div>

        <button
          onClick={runRetrieval}
          disabled={loading || !query.trim() || documents.length === 0}
          className="btn-signal flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-ui-label text-white shadow-md shadow-brass/25 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-white" : "text-white"} />
          <span>{loading ? "Retrieving..." : "Run Retrieval"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-ink/80 rounded-2xl border border-fog/20 p-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-data-mono uppercase tracking-wider text-fog">
                Document filter
              </span>
              <select
                value={documentFilter}
                onChange={(e) => setDocumentFilter(e.target.value)}
                className="w-full bg-ink border border-fog/20 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-brass cursor-pointer"
              >
                <option value="ALL">All indexed documents</option>
                {documents.map((doc) => (
                  <option key={doc.name} value={doc.name}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-[10px] font-data-mono uppercase tracking-wider text-fog">
                Query
              </span>
              <div className="flex items-center gap-2 bg-ink border border-fog/20 rounded-xl px-3 py-2 focus-within:border-brass/60">
                <Search size={14} className="text-brass shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runRetrieval()}
                  placeholder="Ask about a specification, table, or component..."
                  className="w-full bg-transparent text-xs text-parchment placeholder:text-fog/50 focus:outline-none"
                />
              </div>
            </label>
          </div>

          <div className="bg-ink/80 rounded-2xl border border-fog/20 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-fog/10 mb-2">
              <span className="text-[10px] font-data-mono uppercase tracking-wider text-fog flex items-center gap-1.5">
                <Database size={12} className="text-cyan" />
                Retrieved evidence
              </span>
              <span className="text-[10px] font-data-mono text-brass">
                {results.length} chunk{results.length === 1 ? "" : "s"}
              </span>
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-fog py-4 text-center">
                No documents indexed yet. Upload a file in the Library to run retrieval.
              </p>
            ) : !hasRun ? (
              <p className="text-xs text-fog py-4 text-center">
                Run a query to inspect the real retrieved chunks.
              </p>
            ) : results.length === 0 ? (
              <p className="text-xs text-fog py-4 text-center">
                No chunks matched this query for the selected document.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {results.map((item, idx) => {
                  const meta = TYPE_META[item.chunk_type] || TYPE_META.text;
                  const Icon = meta.icon;
                  const isSelected = selected === item;
                  return (
                    <button
                      key={`${item.source}-${item.page}-${idx}`}
                      onClick={() => setSelected(item)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-indigo/70 border-brass/50"
                          : "bg-ink/60 border-fog/10 hover:border-fog/30"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-data-mono mb-1">
                        <span className="text-fog truncate max-w-[65%]">{item.source}</span>
                        <span className="text-brass">Page {item.page || "?"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={12} className={meta.color} />
                        <span className={`text-[10px] font-data-mono uppercase ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-data-mono text-fog ml-auto">
                          score {Number(item.score || 0).toFixed(3)}
                        </span>
                      </div>
                      <p className="text-[11px] text-fog font-body line-clamp-2">{item.text}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="p-5 rounded-2xl bg-indigo/70 border border-brass/30 space-y-3 min-h-[260px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brass font-ui flex items-center gap-1.5">
                <Crosshair size={14} /> Real Evidence Inspector
              </span>
              {selected && (
                <span className="text-[10px] font-data-mono px-2 py-0.5 rounded bg-ink text-brass">
                  {selected.chunk_type || "text"}
                </span>
              )}
            </div>

            {selected ? (
              <>
                <div className="p-3 rounded-xl bg-ink/90 font-data-mono text-[11px] text-brass space-y-1 border border-fog/10">
                  <div>Document: {selected.source || "Unknown"}</div>
                  <div>Page: {selected.page || "Unknown"}</div>
                  <div>Relevance score: {Number(selected.score || 0).toFixed(4)}</div>
                </div>
                <div className="p-4 rounded-xl bg-ink/80 border border-brass/25 text-xs font-body text-parchment leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {selected.text || "No text content in this chunk."}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-fog">
                <Layers size={28} className="mb-2 text-brass/60" />
                <p className="text-xs">
                  Select a retrieved chunk to inspect its exact indexed content and page citation.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 rounded-xl bg-ink/60 border border-fog/10 flex items-center justify-between text-[11px] font-data-mono text-fog">
            <div className="flex items-center gap-2">
              {error ? (
                <>
                  <ShieldAlert size={12} className="text-rust" />
                  <span className="text-rust">{error}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} className="text-moss" />
                  <span>No fabricated data: every result comes from the vector index.</span>
                </>
              )}
            </div>
            <button
              onClick={() => onLaunchChat && onLaunchChat()}
              className="flex items-center gap-1.5 text-brass hover:text-parchment transition-colors font-semibold"
            >
              <span>Ask in Chat</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
