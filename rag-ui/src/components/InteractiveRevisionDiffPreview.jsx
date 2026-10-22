import React, { useEffect, useState } from "react";
import {
  GitCompare,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { API_BASE } from "../config";

export function InteractiveRevisionDiffPreview({ onOpenCompare }) {
  const [documents, setDocuments] = useState([]);
  const [docA, setDocA] = useState("");
  const [docB, setDocB] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/documents`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        setDocuments(data);
        if (data.length >= 2) {
          setDocA(data[0].name);
          setDocB(data[1].name);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const runComparison = async () => {
    if (!docA || !docB) return;
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
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || `Comparison failed with status ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message || "Failed to compare the selected documents.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-2xl bg-indigo/60 border border-fog/15 p-5 sm:p-6 backdrop-blur-xl space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-fog/10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan/15 text-cyan border border-cyan/30">
            <GitCompare size={18} />
          </div>
          <div>
            <h4 className="font-ui font-semibold text-sm text-parchment">
              Live Revision Diff Engine
            </h4>
            <div className="text-[11px] text-fog font-data-mono">
              Runs against the documents indexed in your library
            </div>
          </div>
        </div>
      </div>

      {documents.length < 2 ? (
        <div className="p-4 rounded-xl bg-ink/60 border border-fog/10 text-xs text-fog">
          Upload at least two document revisions in the Library to preview a real comparison.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-fog font-ui-label">
                Revision A
              </span>
              <select
                value={docA}
                onChange={(e) => setDocA(e.target.value)}
                className="w-full bg-ink/80 border border-fog/20 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-brass cursor-pointer"
              >
                {documents.map((doc) => (
                  <option key={`a-${doc.name}`} value={doc.name}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-fog font-ui-label">
                Revision B
              </span>
              <select
                value={docB}
                onChange={(e) => setDocB(e.target.value)}
                className="w-full bg-ink/80 border border-fog/20 rounded-xl px-3 py-2 text-xs text-parchment focus:outline-none focus:border-brass cursor-pointer"
              >
                {documents.map((doc) => (
                  <option key={`b-${doc.name}`} value={doc.name}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            onClick={runComparison}
            disabled={loading || !docA || !docB}
            className="btn-signal w-full py-2.5 rounded-xl text-white font-semibold text-xs font-ui transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <GitCompare size={13} />}
            {loading ? "Comparing revisions..." : "Run Real Comparison"}
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rust/10 border border-rust/30 text-rust text-xs flex items-center gap-2">
          <ShieldAlert size={14} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-2.5">
          <p className="text-xs text-fog leading-relaxed border-b border-fog/10 pb-2">
            {result.summary}
          </p>
          {result.changes?.length ? (
            result.changes.slice(0, 3).map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-ink/70 border border-fog/10 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {item.severity === "critical" ? (
                    <AlertTriangle size={13} className="text-rust shrink-0" />
                  ) : (
                    <CheckCircle2 size={13} className="text-moss shrink-0" />
                  )}
                  <span className="font-semibold text-parchment font-ui truncate">
                    {item.item}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-data-mono text-[11px]">
                  <span className="px-2 py-1 rounded bg-ink border border-fog/20 text-fog line-through">
                    {item.old_value || "—"}
                  </span>
                  <ArrowRight size={12} className="text-brass" />
                  <span className="px-2 py-1 rounded bg-indigo/90 border border-brass/40 text-brass font-bold">
                    {item.new_value || "—"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-fog italic">No differences detected in the aligned sections.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-fog/10 text-xs font-ui">
        <span className="text-[11px] font-data-mono text-fog">
          Powered by the same /compare endpoint as the workspace
        </span>
        <button
          onClick={onOpenCompare}
          className="flex items-center gap-1.5 text-cyan hover:text-parchment font-semibold transition-colors"
        >
          <span>Open Full Comparator</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
