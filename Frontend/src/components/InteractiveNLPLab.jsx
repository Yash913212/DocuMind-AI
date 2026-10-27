import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Sliders,
  Search,
  CheckCircle2,
  Cpu,
  ArrowRight,
  Tag,
  Activity,
  Zap,
  Network,
  RefreshCw,
  AlignLeft,
} from "lucide-react";
import { API_BASE } from "../config";

const PRESET_QUERIES = [
  {
    id: "spec-astm",
    title: "High-Temp Tensile Spec (Table)",
    text: "Verify minimum tensile yield strength for Grade 316L flange at elevated 350°C per ASTM A240",
  },
  {
    id: "fluid-manifold",
    title: "Hydraulic Circuit & Valve (Schematic)",
    text: "Extract maximum allowable manifold relief valve RV-101 cracking pressure from hydraulic schematic Figure 6.1",
  },
  {
    id: "param-drift",
    title: "Governor Cutoff Drift (Comparator)",
    text: "Identify numerical parameter differences between Rev A and Rev B governor cutoff trip limits at 3750 RPM",
  },
  {
    id: "sop-maintenance",
    title: "Bearing Lubrication SOP (Procedural)",
    text: "Explain sequential procedure to inspect and lubricate drive motor M1 bearings per SOP-14 maintenance protocol",
  },
];

export function InteractiveNLPLab({ onLaunchChat }) {
  const [documents, setDocuments] = useState([]);
  const [inputText, setInputText] = useState(PRESET_QUERIES[0].text);
  const [activeTab, setActiveTab] = useState("tokens"); // 'tokens' | 'intent' | 'ner' | 'embeddings' | 'fusion'
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [rrfK, setRrfK] = useState(60);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/documents`)
      .then((res) => (res.ok ? res.json() : []))
      .then((docs) => setDocuments(docs))
      .catch(() => {});
  }, []);

  const queries = useMemo(() => {
    if (documents && documents.length > 0) {
      const docName = documents[0].name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
      return [
        {
          id: "library-doc",
          title: `${docName} (Indexed)`,
          text: `Verify technical requirements, component parameters, and safety limits in ${docName}`,
        },
        ...PRESET_QUERIES,
      ];
    }
    return PRESET_QUERIES;
  }, [documents]);

  const runAnalysis = async (textToAnalyze) => {
    const text = textToAnalyze || inputText;
    if (!text.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/nlp/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error(`NLP analysis failed with status ${res.status}`);
      }

      const data = await res.json();
      setAnalysis(data);
      setSelectedToken(data.estimated_tokens?.[0] || null);
    } catch (err) {
      console.error("NLP analysis failed:", err);
      setAnalysis(null);
      setSelectedToken(null);
      setError(err.message || "Unable to reach the NLP backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis(PRESET_QUERIES[0].text);
  }, []);

  const handleSelectPreset = (preset) => {
    setInputText(preset.text);
    runAnalysis(preset.text);
  };

  // Dynamically recompute RRF when slider moves
  const dynamicRRF = useMemo(() => {
    if (!analysis?.bm25_dense_fusion_preview?.fused_candidates) return [];
    return analysis.bm25_dense_fusion_preview.fused_candidates.map((cand) => {
      const score = (1.0 / (rrfK + cand.dense_rank)) + (1.0 / (rrfK + cand.bm25_rank));
      return {
        ...cand,
        recomputedScore: score.toFixed(5),
      };
    }).sort((a, b) => b.recomputedScore - a.recomputedScore);
  }, [analysis, rrfK]);

  const getTokenStyle = (category) => {
    switch (category) {
      case "metric":
      case "value":
        return "bg-moss/20 text-moss border-moss/40 hover:bg-moss/30";
      case "component":
        return "bg-brass/20 text-brass border-brass/40 hover:bg-brass/30";
      case "verb":
        return "bg-cyan/20 text-cyan border-cyan/40 hover:bg-cyan/30";
      case "punct":
        return "bg-fog/10 text-fog border-fog/20";
      default:
        return "bg-indigo/40 text-parchment/80 border-fog/15 hover:bg-indigo/60";
    }
  };

  return (
    <div className="w-full rounded-3xl glass-card border border-brass/25 shadow-2xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-2xl space-y-6">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-violet/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-brass/10 blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-fog/15 pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass/15 border border-brass/35 text-brass text-xs font-data-mono">
            <Brain size={13} className="text-brass animate-pulse" />
            <span>DocuMind AI NLP Subsystem • SentenceTransformers & Hybrid RRF</span>
          </div>
          <h3 className="font-hero text-2xl sm:text-3xl text-parchment font-semibold">
            Interactive Natural Language Processing Lab
          </h3>
          <p className="font-body text-fog text-xs sm:text-sm max-w-2xl">
            Inspect how DocuMind AI tokenizes engineering phrasing, disambiguates retrieval intents,
            extracts component specifications, and computes dense-sparse reciprocal rank fusion.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => runAnalysis(inputText)}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-indigo/70 hover:bg-indigo text-parchment border border-fog/20 text-xs font-ui flex items-center gap-2 transition-all hover:border-brass/40 shadow-md"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-brass" : "text-fog"} />
            <span>{loading ? "Analyzing..." : "Re-Analyze"}</span>
          </button>

          {onLaunchChat && (
            <button
              onClick={() => onLaunchChat(inputText)}
              className="btn-signal px-4 py-2.5 rounded-xl text-white font-semibold text-xs font-ui flex items-center gap-2 shadow-md shadow-brass/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Execute in Chat</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rust/10 border border-rust/30 text-rust text-xs font-body">
          {error} Start the backend to analyze text with the real NLP pipeline.
        </div>
      )}

      {/* Preset Queries Pill Strip */}
      <div className="space-y-2">
        <div className="text-[11px] font-data-mono text-fog uppercase tracking-wider flex items-center gap-2">
          <Tag size={12} className="text-brass" />
          <span>Select Verified Engineering Query:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {queries.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className={`p-3 rounded-xl text-left border transition-all text-xs flex flex-col justify-between ${
                inputText === preset.text
                  ? "bg-brass/15 border-brass text-parchment shadow-md shadow-brass/10"
                  : "bg-ink/60 border-fog/15 text-fog hover:text-parchment hover:border-fog/30"
              }`}
            >
              <span className="font-semibold font-ui text-[11px] text-brass mb-1">
                {preset.title}
              </span>
              <span className="line-clamp-2 text-[11px] font-body text-fog">
                "{preset.text}"
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Query Input Box */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-ink/90 border border-fog/20 rounded-2xl focus-within:border-brass/60 transition-colors shadow-inner">
          <Search size={16} className="text-brass shrink-0 ml-1" />
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runAnalysis(inputText)}
            placeholder="Type or customize an engineering query to analyze with the NLP engine..."
            className="w-full bg-transparent text-parchment placeholder-fog/50 text-xs sm:text-sm font-body outline-none"
          />
          <button
            onClick={() => runAnalysis(inputText)}
            disabled={loading}
            className="btn-signal px-3.5 py-1.5 rounded-lg text-white font-semibold text-xs font-ui shrink-0 hover:scale-[1.02] active:scale-[0.98]"
          >
            Analyze
          </button>
        </div>
      </div>

      {/* Real-time NLP Telemetry Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-ink/70 border border-brass/25 flex flex-col justify-between">
          <span className="text-[10px] font-data-mono text-fog uppercase">Linguistic Tokens</span>
          <div className="text-xl font-hero font-semibold text-brass mt-1">
            {analysis?.token_count || 0}
          </div>
          <span className="text-[10px] font-body text-fog mt-0.5">Boundary-aware split</span>
        </div>

        <div className="p-3.5 rounded-xl bg-ink/70 border border-cyan/25 flex flex-col justify-between">
          <span className="text-[10px] font-data-mono text-fog uppercase">Detected NLP Intent</span>
          <div className="text-lg font-hero font-semibold text-cyan mt-1 capitalize">
            {analysis?.detected_intent || "Factual"}
          </div>
          <span className="text-[10px] font-body text-fog mt-0.5">Dynamic prompt routing</span>
        </div>

        <div className="p-3.5 rounded-xl bg-ink/70 border border-moss/25 flex flex-col justify-between">
          <span className="text-[10px] font-data-mono text-fog uppercase">Extracted Entities</span>
          <div className="text-xl font-hero font-semibold text-moss mt-1">
            {analysis?.entities?.length || 0}
          </div>
          <span className="text-[10px] font-body text-fog mt-0.5">Components & specs</span>
        </div>

        <div className="p-3.5 rounded-xl bg-ink/70 border border-violet/25 flex flex-col justify-between">
          <span className="text-[10px] font-data-mono text-fog uppercase">Latent Vector Dimension</span>
          <div className="text-xl font-hero font-semibold text-violet mt-1">
            384-Dim / 768-Dim
          </div>
          <span className="text-[10px] font-body text-fog mt-0.5">MPNet & MiniLM dense space</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-fog/15">
        {[
          { id: "tokens", label: "01. Tokenization & Lexicon", icon: AlignLeft },
          { id: "intent", label: "02. Intent Classification", icon: Cpu },
          { id: "ner", label: "03. NER & Knowledge Relations", icon: Network },
          { id: "embeddings", label: "04. Dense Cosine Similarity", icon: Activity },
          { id: "fusion", label: "05. BM25 + Dense RRF Fusion", icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-ui flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive
                  ? "bg-brass text-white font-semibold shadow-md shadow-brass/25"
                  : "text-fog hover:text-parchment hover:bg-indigo/40"
              }`}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels Content */}
      <div className="min-h-[290px]">
        {/* TAB 1: Tokenization */}
        {activeTab === "tokens" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-data-mono text-fog">
                Interactive Token Stream (Click any token to inspect linguistic metadata):
              </span>
              <div className="flex items-center gap-3 text-[11px] font-data-mono">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-brass/50 border border-brass" /> Component
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-moss/50 border border-moss" /> Metric/Unit
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-cyan/50 border border-cyan" /> Action Verb
                </span>
              </div>
            </div>

            {/* Token Pills Cloud */}
            <div className="p-4 sm:p-5 rounded-2xl bg-ink/80 border border-fog/15 flex flex-wrap gap-2 items-center min-h-[100px]">
              {analysis?.estimated_tokens?.map((tok, idx) => {
                const isSelected = selectedToken?.token_id === tok.token_id;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedToken(tok)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-data-mono transition-all flex items-center gap-1.5 ${getTokenStyle(
                      tok.category
                    )} ${isSelected ? "ring-2 ring-brass scale-105 shadow-md" : ""}`}
                  >
                    <span>{tok.text}</span>
                    <span className="text-[9px] opacity-60">#{tok.token_id}</span>
                  </button>
                );
              })}
            </div>

            {/* Token Inspector Detail Card */}
            {selectedToken && (
              <div className="p-4 rounded-xl bg-indigo/40 border border-fog/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-data-mono">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-md bg-brass/20 text-brass border border-brass/40 font-bold">
                    Token: "{selectedToken.text}"
                  </span>
                  <span className="text-fog">
                    Category: <strong className="text-parchment uppercase">{selectedToken.category}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-4 text-fog">
                  <span>POS Tag: <strong className="text-cyan">{selectedToken.pos_tag}</strong></span>
                  <span>ID: <strong className="text-brass">#{selectedToken.token_id}</strong></span>
                  <span>Span: <strong className="text-moss">[{selectedToken.start_char}:{selectedToken.end_char}]</strong></span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: Intent Classification */}
        {activeTab === "intent" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="text-xs font-data-mono text-fog flex items-center justify-between">
              <span>Intent Softmax Probability Distribution:</span>
              <span className="text-cyan">Winner: {analysis?.detected_intent?.toUpperCase()}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {analysis?.intent_scores?.map((scoreItem, idx) => {
                const isWinner = scoreItem.intent === analysis?.detected_intent;
                const percentage = Math.round(scoreItem.confidence * 100);
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      isWinner
                        ? "bg-indigo/80 border-brass/50 shadow-lg shadow-brass/10"
                        : "bg-ink/60 border-fog/15 opacity-80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isWinner ? (
                          <CheckCircle2 size={15} className="text-brass" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-fog/30" />
                        )}
                        <span className="font-ui font-semibold text-sm capitalize text-parchment">
                          {scoreItem.intent} Intent
                        </span>
                      </div>
                      <span className="font-data-mono text-xs text-brass font-bold">
                        {percentage}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-ink/90 overflow-hidden mb-2.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={`h-full ${isWinner ? "bg-brass" : "bg-cyan/60"}`}
                      />
                    </div>

                    <p className="text-[11px] font-body text-fog leading-relaxed">
                      {scoreItem.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Prompt Routing Explanation Callout */}
            <div className="p-3.5 rounded-xl bg-cyan/10 border border-cyan/25 flex items-start gap-2.5 text-xs font-body text-fog">
              <Zap size={15} className="text-cyan shrink-0 mt-0.5" />
              <span>
                <strong>System Routing Strategy:</strong> When classified as <em>{analysis?.detected_intent}</em>,
                DocuMind AI activates specialized multi-vector retriever weights (weighting tables and visual pages higher)
                and injects structured constraint rules into the LLM system prompt to prevent numerical hallucinations.
              </span>
            </div>
          </motion.div>
        )}

        {/* TAB 3: NER & Knowledge Graph Relations */}
        {activeTab === "ner" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Extracted Named Entities */}
              <div className="p-4 rounded-2xl bg-ink/80 border border-fog/15 space-y-3">
                <div className="flex items-center justify-between text-xs font-data-mono text-fog pb-2 border-b border-fog/10">
                  <span className="flex items-center gap-1.5 text-brass">
                    <Tag size={13} />
                    <span>Recognized Entities (NER)</span>
                  </span>
                  <span>{analysis?.entities?.length || 0} Detected</span>
                </div>

                <div className="space-y-2 min-h-[140px]">
                  {analysis?.entities?.length > 0 ? (
                    analysis.entities.map((ent, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-indigo/40 border border-fog/10 text-xs font-data-mono"
                      >
                        <span className="text-parchment font-semibold">"{ent.entity}"</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ent.type === "COMPONENT"
                              ? "bg-brass/20 text-brass"
                              : ent.type === "SPECIFICATION"
                              ? "bg-moss/20 text-moss"
                              : "bg-cyan/20 text-cyan"
                          }`}
                        >
                          {ent.type}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs font-data-mono text-fog">
                      No explicit engineering entities recognized in this sample.
                    </div>
                  )}
                </div>
              </div>

              {/* Synthesized Graph Relations */}
              <div className="p-4 rounded-2xl bg-ink/80 border border-fog/15 space-y-3">
                <div className="flex items-center justify-between text-xs font-data-mono text-fog pb-2 border-b border-fog/10">
                  <span className="flex items-center gap-1.5 text-moss">
                    <Network size={13} />
                    <span>Knowledge Graph Triples (RE)</span>
                  </span>
                  <span>3D Atlas Feeding</span>
                </div>

                <div className="space-y-2 min-h-[140px]">
                  {analysis?.relations?.length > 0 ? (
                    analysis.relations.map((rel, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-indigo/40 border border-fog/10 text-xs font-data-mono space-y-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-brass font-semibold">[{rel.source}]</span>
                          <span className="text-fog text-[10px]">&mdash; {rel.relation} &rarr;</span>
                          <span className="text-moss font-semibold">[{rel.target}]</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs font-data-mono text-fog">
                      Implicit relation mapped through dense proximity clustering.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-brass/10 border border-brass/25 flex items-center justify-between text-xs font-body text-fog">
              <span>
                These extracted triples automatically populate the interactive <strong>3D Engineering Knowledge Graph</strong> on the Knowledge Map page.
              </span>
              <span className="font-data-mono text-brass text-[11px]">Force-Directed Schema</span>
            </div>
          </motion.div>
        )}

        {/* TAB 4: Dense Cosine Similarity Radar */}
        {activeTab === "embeddings" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between text-xs font-data-mono text-fog">
              <span>Cosine Similarity Against Indexed Engineering Corpora:</span>
              <span className="text-brass">Formula: cos(θ) = (u · v) / (||u|| ||v||)</span>
            </div>

            <div className="space-y-2.5">
              {analysis && analysis.semantic_similarities?.length === 0 && (
                <div className="p-4 text-center text-xs font-data-mono text-fog rounded-xl bg-ink/60 border border-fog/10">
                  No indexed chunks to compare against. Upload a document in the Library first.
                </div>
              )}
              {analysis?.semantic_similarities?.map((simItem, idx) => {
                const percentage = Math.round(simItem.similarity * 100);
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-ink/80 border border-fog/15 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-indigo text-[10px] font-data-mono text-cyan">
                          {simItem.category}
                        </span>
                        <span className="font-ui text-parchment font-medium truncate max-w-md">
                          {simItem.target}
                        </span>
                      </div>
                      <span className="font-data-mono text-brass font-bold">
                        {simItem.similarity.toFixed(3)} ({percentage}%)
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-ink overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={`h-full ${
                          percentage > 80
                            ? "bg-brass"
                            : percentage > 50
                            ? "bg-cyan"
                            : "bg-fog/40"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 5: Reciprocal Rank Fusion (RRF) Calculator */}
        {activeTab === "fusion" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Interactive Slider for Fusion Constant k */}
            <div className="p-4 rounded-2xl bg-indigo/40 border border-fog/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-data-mono text-parchment">
                  <Sliders size={14} className="text-brass" />
                  <span>RRF Ranking Constant (k = {rrfK}):</span>
                </div>
                <p className="text-[11px] font-body text-fog">
                  Controls how aggressively top-ranked sparse keyword matches are prioritized over broader semantic embeddings.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-data-mono text-fog">k=10</span>
                <input
                  type="range"
                  min="10"
                  max="120"
                  value={rrfK}
                  onChange={(e) => setRrfK(Number(e.target.value))}
                  className="w-36 sm:w-48 accent-brass cursor-pointer"
                />
                <span className="text-xs font-data-mono text-fog">k=120</span>
              </div>
            </div>

            {/* Fused Candidates Table */}
            <div className="overflow-x-auto rounded-2xl border border-fog/15">
              <table className="w-full text-left text-xs font-data-mono">
                <thead className="bg-ink/90 border-b border-fog/15 text-fog">
                  <tr>
                    <th className="py-2.5 px-3">Retrieved Document Chunk</th>
                    <th className="py-2.5 px-3 text-center">Dense Rank (r_dense)</th>
                    <th className="py-2.5 px-3 text-center">BM25 Rank (r_bm25)</th>
                    <th className="py-2.5 px-3 text-right">RRF Fusion Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fog/10 bg-ink/60">
                  {dynamicRRF.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 px-3 text-center text-fog">
                        No indexed chunks available for rank fusion.
                      </td>
                    </tr>
                  )}
                  {dynamicRRF.map((item, idx) => (
                    <tr key={idx} className="hover:bg-indigo/30 transition-colors">
                      <td className="py-3 px-3 font-ui text-parchment font-medium">
                        {item.name}
                      </td>
                      <td className="py-3 px-3 text-center text-cyan">
                        #{item.dense_rank}
                      </td>
                      <td className="py-3 px-3 text-center text-moss">
                        #{item.bm25_rank}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-brass">
                        {item.recomputedScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 rounded-xl bg-ink/80 border border-fog/15 text-[11px] font-data-mono text-fog text-center">
              Mathematical Formula: <code>RRF(d) = Σ [ 1 / (k + r_m(d)) ] = 1/({rrfK} + r_dense) + 1/({rrfK} + r_bm25)</code>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
