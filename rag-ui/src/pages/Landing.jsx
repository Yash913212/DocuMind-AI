import React, { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Database,
  Compass,
  Layers,
  GitCompare,
  BookOpen,
  CheckCircle2,
  Lock,
  Activity,
  Zap,
  Terminal,
  Crosshair,
  Search,
  Workflow,
  Brain,
} from "lucide-react";
import { API_BASE } from "../config";
import { ParticleNeuralGlobe } from "../components/ParticleNeuralGlobe";
import { InteractiveRAGSimulator } from "../components/InteractiveRAGSimulator";
import { InteractiveRevisionDiffPreview } from "../components/InteractiveRevisionDiffPreview";
import { InteractiveNLPLab } from "../components/InteractiveNLPLab";
import { CountUp, Magnetic, Reveal } from "../components/CinematicFX";
import { DocuMindLogo } from "../components/DocuMindLogo";

const Marquee = () => {
  const items = [
    "Multimodal Page-Aware RAG",
    "NLP SentenceTransformers & LangChain",
    "Dense & BM25 Reciprocal Rank Fusion",
    "Linguistic Intent Classification",
    "ChromaDB Vector Store & BM25",
    "PyMuPDF Page Coordinate Citations",
    "Groq & Ollama Fallback Chain",
    "Vision Model Page Understanding",
    "Revision Parameter Drift Comparator",
    "3D Force-Directed Knowledge Atlas",
    "Technical Flashcard & Quiz Engine",
    "Local-First Private Mode",
    "FastAPI Server-Sent Events (SSE)",
  ];
  return (
    <div className="marquee-mask w-full overflow-hidden whitespace-nowrap bg-indigo/40 backdrop-blur-xl py-3.5 border-y border-fog/8">
      <div className="inline-block animate-[marquee_28s_linear_infinite] hover:[animation-play-state:paused]">
        {items
          .concat(items)
          .concat(items)
          .map((item, i) => (
            <span
              key={i}
              className="mx-6 font-data-mono text-fog/80 uppercase text-xs tracking-widest inline-flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brass/70 shadow-[0_0_6px_#e10600]" />
              {item}
            </span>
          ))}
      </div>
    </div>
  );
};

export function Landing({ onNavigate, onOpenCommandPalette }) {
  const containerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ container: containerRef });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const [libraryStats, setLibraryStats] = useState({
    documents: 0,
    pages: 0,
    chunks: 0,
    tables: 0,
  });

  useEffect(() => {
    fetch(`${API_BASE}/documents`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setLibraryStats({
          documents: data.length,
          pages: data.reduce((sum, doc) => sum + (doc.pages || 0), 0),
          chunks: data.reduce((sum, doc) => sum + (doc.chunks || 0), 0),
          tables: data.reduce((sum, doc) => sum + (doc.tables || 0), 0),
        });
      })
      .catch(() => {});
  }, []);

  const scrollToSection = (id) => {
    if (onNavigate) {
      onNavigate(id);
    } else {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.11, delayChildren: 0.08 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 28, filter: "blur(10px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { ease: [0.22, 1, 0.36, 1], duration: 0.8 },
    },
  };

  const wordVariant = {
    hidden: { y: "118%", rotate: 3, opacity: 0 },
    show: {
      y: "0%",
      rotate: 0,
      opacity: 1,
      transition: { ease: [0.16, 1, 0.3, 1], duration: 0.9 },
    },
  };

  const headlineWords = [
    { text: "Engineering", serif: true },
    { text: "manuals" },
    { text: "understood,", accent: true, serif: true, italic: true },
    { text: "verified" },
    { text: "&" },
    { text: "mapped.", serif: true },
  ];

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-y-auto bg-ink text-parchment relative scroll-smooth">
      {/* Background Radial Glow Accents — Charcoal + Signal Red Atmosphere */}
      <div className="absolute top-0 left-1/4 w-[700px] h-[500px] bg-brass/[0.07] rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute top-[30%] right-0 w-[550px] h-[550px] bg-cyan/[0.04] rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-0 w-[700px] h-[500px] bg-indigo/15 rounded-full blur-[200px] pointer-events-none" />
      <div className="absolute top-[60%] left-[40%] w-[400px] h-[400px] bg-brass/[0.04] rounded-full blur-[160px] pointer-events-none" />

      {/* Cinematic Atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="hero-grid absolute inset-0 opacity-60" />
        <motion.div
          className="absolute -top-24 left-[18%] h-[430px] w-[430px] rounded-full bg-brass/10 blur-[130px]"
          animate={
            reduceMotion
              ? undefined
              : { x: [0, 46, -18, 0], y: [0, 34, 12, 0], scale: [1, 1.16, 1.06, 1] }
          }
          transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[30%] right-[4%] h-[520px] w-[520px] rounded-full bg-parchment/[0.045] blur-[150px]"
          animate={
            reduceMotion
              ? undefined
              : { x: [0, -38, 16, 0], y: [0, 26, -18, 0], scale: [1, 1.12, 1.04, 1] }
          }
          transition={{ duration: 23, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="hero-scanbeam" />
      </div>

      {/* Top Floating Header */}
      <header className="px-6 sm:px-12 py-4 flex justify-between items-center border-b border-fog/8 bg-ink/85 backdrop-blur-2xl sticky top-0 z-30 shadow-lg shadow-black/20">
        <div className="flex items-center gap-3">
          <DocuMindLogo size={40} animate={true} />
          <div>
            <div className="font-hero text-xl tracking-tight text-parchment">
              DocuMind AI
            </div>
            <div className="text-[10px] font-ui-label text-fog uppercase tracking-wider hidden sm:block">
              Multimodal Engineering Intelligence & 3D Knowledge Atlas
            </div>
          </div>
        </div>

        {/* Center Quick Navigation Anchors */}
        <div className="hidden md:flex items-center gap-5 text-xs font-ui-label text-fog">
          <a
            href="#simulator"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("simulator")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hover:text-parchment transition-colors"
          >
            Live Simulator
          </a>
          <a
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hover:text-parchment transition-colors"
          >
            Capabilities
          </a>
          <a
            href="#architecture"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("architecture")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hover:text-parchment transition-colors"
          >
            Architecture
          </a>
        </div>

        {/* Header Right Action Items */}
        <div className="flex items-center gap-3">
          {/* Quick Search Shortcut */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo/60 hover:bg-indigo border border-fog/20 text-xs font-data-mono text-fog hover:text-parchment transition-all"
            title="Press ⌘K for Command Palette"
          >
            <Search size={13} className="text-brass" />
            <span>Search</span>
            <kbd className="px-1.5 py-0.5 rounded bg-ink border border-fog/30 text-[10px] text-brass">
              ⌘K
            </kbd>
          </button>

          {libraryStats.documents > 0 && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo/50 border border-fog/15 text-xs font-data-mono text-parchment">
              <span className="w-2 h-2 rounded-full bg-moss animate-pulse" />
              <span>
                {libraryStats.documents} {libraryStats.documents === 1 ? "doc" : "docs"} indexed
              </span>
            </div>
          )}

          <button
            onClick={() => scrollToSection("chat")}
            className="btn-signal flex items-center gap-2 px-4 py-2 rounded-xl font-ui-label text-white shadow-lg shadow-brass/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Launch Workspace</span>
            <ArrowRight size={15} />
          </button>
        </div>

        <motion.div
          className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-brass via-brass/55 to-transparent"
          style={{ scaleX: smoothProgress }}
        />
      </header>

      {/* Main Hero Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-12 lg:px-16 pt-10 sm:pt-14 pb-16 space-y-16 sm:space-y-24">
        {/* Top Hero Section */}
        <div className="flex flex-col lg:flex-row items-center gap-10 sm:gap-14 relative">
          <motion.div
            className="w-full lg:w-[60%] z-10 space-y-6 pt-2"
            variants={container}
            initial={reduceMotion ? false : "hidden"}
            animate="show"
          >
            {/* Editorial Category Tags matching the sample demo: IDEAS / DESIGN / IMPACT */}
            <motion.div variants={item} className="flex items-center gap-2.5 text-[11px] font-data-mono uppercase tracking-[0.2em] text-fog">
              <span>MULTIMODAL RAG</span>
              <span className="text-brass font-bold">&bull;</span>
              <span>SUB-PIXEL CITATIONS</span>
              <span className="text-brass font-bold">&bull;</span>
              <span>LOCAL-FIRST</span>
            </motion.div>

            {/* Main Headline with Editorial Luxury Typography & Signal Red Accent */}
            <motion.h1
              variants={item}
              aria-label="Engineering manuals understood, verified and mapped."
              className="text-4xl sm:text-6xl lg:text-[70px] tracking-[-0.035em] leading-[1.08] text-parchment"
            >
              {headlineWords.map((word, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="inline-block overflow-hidden align-bottom mr-[0.24em] pb-[0.09em] -mb-[0.09em]"
                >
                  <motion.span
                    variants={wordVariant}
                    className={`inline-block ${
                      word.serif ? "font-serif text-[1.12em] tracking-tight font-normal" : "font-display font-semibold"
                    } ${
                      word.italic ? "italic" : ""
                    } ${
                      word.accent
                        ? "text-[#e10600] font-normal drop-shadow-[0_0_24px_rgba(225,6,0,0.35)]"
                        : "text-parchment"
                    }`}
                  >
                    {word.text}
                  </motion.span>
                </span>
              ))}
            </motion.h1>

            {/* Description */}
            <motion.p
              variants={item}
              className="font-body text-fog text-base sm:text-lg max-w-[62ch] leading-relaxed"
            >
              Stop skimming through 200-page engineering manuals. Extract structured tables,
              analyze circuit schematics, detect numerical revision parameter drift, and explore 
              3D knowledge graphs — with a <strong className="text-parchment font-medium">local-first private mode</strong>.
            </motion.p>

            {/* Action Buttons */}
            <motion.div variants={item} className="flex flex-wrap items-center gap-3.5 pt-2">
              <Magnetic
                onClick={() => scrollToSection("chat")}
                className="btn-signal group flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-ui-label text-white shadow-xl shadow-brass/30"
              >
                <Compass size={18} className="transition-transform duration-500 group-hover:rotate-[18deg]" />
                <span>Explore Chat & Reasoning</span>
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Magnetic>

              <button
                onClick={() => {
                  document.getElementById("simulator")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-indigo/70 hover:bg-indigo text-parchment border border-fog/20 hover:border-brass/40 rounded-xl font-ui-label transition-all hover:-translate-y-0.5 shadow-md"
              >
                <Zap size={18} className="text-brass" />
                <span>Try Live Simulator</span>
              </button>

              <button
                onClick={() => {
                  document.getElementById("nlp-lab")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex items-center gap-2.5 px-5 py-3.5 bg-indigo/70 hover:bg-indigo text-parchment border border-violet/30 hover:border-violet/60 rounded-xl font-ui-label transition-all hover:-translate-y-0.5 shadow-md"
              >
                <Brain size={18} className="text-violet" />
                <span>NLP Engine Lab</span>
              </button>

              <button
                onClick={() => scrollToSection("compare")}
                className="flex items-center gap-2.5 px-5 py-3.5 bg-transparent hover:bg-indigo/30 text-fog hover:text-parchment border border-fog/20 rounded-xl font-ui-label transition-colors"
              >
                <GitCompare size={18} />
                <span>Revision Comparator</span>
              </button>
            </motion.div>

            {/* Key Value Props Ticker */}
            <motion.div variants={item} className="pt-2 flex flex-wrap items-center gap-4 text-xs font-data-mono text-fog">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-moss" />
                <span>Zero Hallucination Grounding</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-cyan" />
                <span>PyMuPDF Coordinate Extraction</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-brass" />
                <span>Local & Cloud Dual Mode</span>
              </div>
            </motion.div>
          </motion.div>

          {/* 3D Fibonacci Particle Neural Globe inside Architectural Arch Frame */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.95, filter: "blur(14px)" }}
            animate={
              reduceMotion
                ? {}
                : { opacity: 1, scale: 1, filter: "blur(0px)", y: [0, -10, 0] }
            }
            transition={{
              opacity: { duration: 0.9, delay: 0.3 },
              scale: { duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] },
              filter: { duration: 0.9, delay: 0.3 },
              y: { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
            }}
            className="w-full lg:w-[40%] h-[400px] sm:h-[480px] lg:h-[540px] relative rounded-t-[140px] rounded-b-3xl overflow-hidden bg-gradient-to-b from-[#1e1e20] to-[#161618] border border-fog/15 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6),0_0_40px_-5px_rgba(225,6,0,0.08)] flex items-center justify-center group cinematic-frame"
          >
            <div className="pointer-events-none absolute inset-4 z-10" aria-hidden="true">
              <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-xl border-l border-t border-parchment/25" />
              <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-xl border-r border-t border-parchment/25" />
              <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-xl border-b border-l border-parchment/25" />
              <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-xl border-b border-r border-parchment/25" />
            </div>

            {/* Architectural Vertical Signal Red Light Beam on right edge */}
            {/* Architectural Signal Red Light Beam — pulsating accent line */}
            <div className="absolute top-8 bottom-8 right-3 w-1.5 rounded-full bg-brass/90 shadow-[0_0_16px_#e10600,0_0_40px_rgba(225,6,0,0.3)] pointer-events-none z-10 animate-soft-glow" />



            {/* 3D Interactive Canvas */}
            <div className="w-full h-full">
              <ParticleNeuralGlobe />
            </div>

            {/* Bottom Telemetry Overlay */}
            <div className="absolute bottom-4 left-4 right-7 z-10 flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#1c1c1e]/90 backdrop-blur-md border border-fog/20 text-xs font-ui-label text-fog">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-[#c0c0c0]" />
                <span className="text-white/80">MiniLM-L6-v2 Semantic Mesh</span>
              </div>
              <span className="font-data-mono text-brass font-semibold">384D &rarr; 3D PCA</span>
            </div>
          </motion.div>
        </div>

        {/* Live Library Stats Row */}
        <Reveal amount={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: "Documents Indexed",
              value: libraryStats.documents,
              sub: "Currently in the vector store",
              icon: Database,
              color: "text-brass",
              borderColor: "border-brass/30",
            },
            {
              label: "Pages Processed",
              value: libraryStats.pages,
              sub: "Across all indexed documents",
              icon: Crosshair,
              color: "text-cyan",
              borderColor: "border-cyan/30",
            },
            {
              label: "Vector Chunks",
              value: libraryStats.chunks,
              sub: "Searchable evidence units",
              icon: Zap,
              color: "text-moss",
              borderColor: "border-moss/30",
            },
            {
              label: "Tables Extracted",
              value: libraryStats.tables,
              sub: "Structured table chunks",
              icon: Layers,
              color: "text-violet",
              borderColor: "border-violet/30",
            },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className={`stat-card p-4 sm:p-5 rounded-2xl glass-card border ${stat.borderColor} transition-all duration-300 hover:-translate-y-1`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-data-mono text-fog uppercase">
                    {stat.label}
                  </span>
                  <div className={`p-1.5 rounded-lg bg-ink/60 ${stat.color}`}>
                    <Icon size={14} />
                  </div>
                </div>
                <div className="font-hero text-2xl sm:text-3xl font-semibold text-parchment">
                  <CountUp value={stat.value} />
                </div>
                <div className="text-[11px] font-body text-fog mt-0.5">
                  {stat.sub}
                </div>
              </div>
            );
          })}
        </div>
        </Reveal>

        {/* Live Interactive Simulator Showcase Section */}
        <section id="simulator" className="space-y-6 pt-4 scroll-mt-24">
          <Reveal>
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass/10 border border-brass/30 text-[11px] font-data-mono text-brass">
              <Terminal size={12} />
              <span>Live Retrieval Sandbox</span>
            </div>
            <h2 className="text-3xl sm:text-4xl text-parchment font-semibold tracking-tight">
              Inspect Real <span className="font-serif italic font-normal text-[#e10600]">Retrieval Evidence</span>
            </h2>
            <p className="font-body text-fog text-sm sm:text-base">
              Run a query against the same vector index used by chat and inspect the exact
              chunks, scores, and page citations that ground each answer.
            </p>
          </div>
          </Reveal>

          {/* Interactive RAG Simulator Component */}
          <Reveal delay={0.06} amount={0.05}>
            <InteractiveRAGSimulator onLaunchChat={() => scrollToSection("chat")} />
          </Reveal>
        </section>

        {/* Live Interactive NLP Intelligence Lab Section */}
        <section id="nlp-lab" className="space-y-6 pt-4 scroll-mt-24">
          <Reveal>
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brass/15 border border-brass/35 text-[11px] font-data-mono text-brass uppercase tracking-wider">
              <Brain size={12} />
              <span>Natural Language Processing Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-4xl text-parchment font-semibold tracking-tight">
              Linguistic & Semantic <span className="font-serif italic font-normal text-[#e10600]">Intelligence Sandbox</span>
            </h2>
            <p className="font-body text-fog text-sm sm:text-base">
              Inspect how DocuMind AI tokenizes complex engineering vocabulary, classifies retrieval intents,
              extracts physical component relationships, and fuses dense-sparse semantic latent spaces.
            </p>
          </div>
          </Reveal>

          {/* Interactive NLP Lab Component */}
          <Reveal delay={0.06} amount={0.05}>
            <InteractiveNLPLab onLaunchChat={() => scrollToSection("chat")} />
          </Reveal>
        </section>

        {/* Bento Grid Feature Capabilities Section */}
        <section id="features" className="space-y-8 pt-4 scroll-mt-24">
          <Reveal>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-data-mono uppercase text-brass tracking-widest mb-1">
                Engineering Capabilities
              </div>
              <h2 className="text-3xl sm:text-4xl text-parchment font-semibold tracking-tight">
                Purpose-Built for <span className="font-serif italic font-normal text-[#e10600]">Engineering Manuals</span>
              </h2>
            </div>
            <p className="font-body text-fog text-sm max-w-md">
              Generic LLMs hallucinate numbers and miss table layouts. DocuMind AI was built from the
              ground up for technical manuals, drawings, and rigorous standards.
            </p>
          </div>
          </Reveal>

          {/* Bento Grid */}
          <Reveal amount={0.04}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Bento Card 1: Interactive Revision Diff (Wide 7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-7 rounded-3xl glass-card holo-card border border-cyan/25 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="p-2.5 rounded-xl bg-cyan/15 text-cyan border border-cyan/30">
                    <GitCompare size={20} />
                  </span>
                  <span className="font-data-mono text-xs text-fog">FEATURE 01</span>
                </div>
                <h3 className="font-hero text-xl sm:text-2xl text-parchment font-semibold mb-2">
                  Numerical Parameter Drift & Revision Diffing
                </h3>
                <p className="font-body text-fog text-xs sm:text-sm leading-relaxed mb-4">
                  Compare Revision A vs Revision B of technical manuals. DocuMind AI aligns identical
                  sections and isolates altered torque limits, pressure ceilings, and regulatory mandates.
                </p>

                {/* Embedded Live Revision Diff Preview */}
                <InteractiveRevisionDiffPreview onOpenCompare={() => scrollToSection("compare")} />
              </div>
            </div>

            {/* Bento Card 2: 3D Force-Directed Knowledge Graph (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-7 rounded-3xl glass-card holo-card border border-brass/25 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="p-2.5 rounded-xl bg-brass/15 text-brass border border-brass/30">
                    <Layers size={20} />
                  </span>
                  <span className="font-data-mono text-xs text-fog">FEATURE 02</span>
                </div>
                <h3 className="font-hero text-xl sm:text-2xl text-parchment font-semibold mb-2">
                  3D Force-Directed Knowledge Graph
                </h3>
                <p className="font-body text-fog text-xs sm:text-sm leading-relaxed mb-4">
                  Cluster relationships between engineering assemblies, components, and safety standards
                  in interactive 3D space with Louvain community detection.
                </p>

                <div className="p-4 rounded-2xl bg-ink/80 border border-fog/15 relative overflow-hidden group">
                  <div className="flex items-center justify-between text-xs font-data-mono text-fog mb-3">
                    <span className="text-brass">Graph Source</span>
                    <span className="px-2 py-0.5 rounded bg-indigo text-parchment text-[10px]">
                      Live index
                    </span>
                  </div>

                  <p className="text-xs font-body text-fog leading-relaxed">
                    Nodes and relationships are extracted from the documents currently indexed in
                    your library. No preloaded graph data is displayed.
                  </p>

                  <button
                    onClick={() => scrollToSection("map")}
                    className="mt-4 w-full py-2.5 bg-brass/15 hover:bg-brass text-brass hover:text-white font-semibold rounded-xl text-xs font-ui transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-brass/25"
                  >
                    <span>Launch 3D Knowledge Map</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Bento Card 3: Local-First Privacy (4 cols) */}
            <div className="lg:col-span-4 p-6 sm:p-7 rounded-3xl glass-card holo-card border border-moss/25 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="p-2 rounded-xl bg-moss/15 text-moss border border-moss/30">
                    <ShieldCheck size={18} />
                  </span>
                  <span className="font-data-mono text-xs text-fog">SECURITY</span>
                </div>
                <h3 className="font-ui font-semibold text-lg text-parchment mb-2">
                  Local-First Private Mode
                </h3>
                <p className="font-body text-fog text-xs leading-relaxed mb-4">
                  Private mode disables web search and prefers local Ollama with local ChromaDB.
                  If Ollama is unavailable, chat can fall back to Groq so the workspace stays usable.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-ink/80 border border-moss/30 flex items-center justify-between text-xs font-data-mono">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-moss" />
                  <span className="text-parchment">Local engine preferred</span>
                </div>
                <span className="text-moss font-bold">Web search off</span>
              </div>
            </div>

            {/* Bento Card 4: Sub-pixel Coordinate Citations (4 cols) */}
            <div className="lg:col-span-4 p-6 sm:p-7 rounded-3xl glass-card holo-card border border-brass/25 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="p-2 rounded-xl bg-brass/15 text-brass border border-brass/30">
                    <Crosshair size={18} />
                  </span>
                  <span className="font-data-mono text-xs text-fog">CITATION RADAR</span>
                </div>
                <h3 className="font-ui font-semibold text-lg text-parchment mb-2">
                  Coordinate Inspector & Citation Drawer
                </h3>
                <p className="font-body text-fog text-xs leading-relaxed mb-4">
                  Every AI response includes clickable citation pills. Clicking any citation opens the
                  exact rendered PDF page with bounding box coordinates highlighted right in the sidebar.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-ink/80 border border-brass/30 flex items-center justify-between text-xs font-data-mono">
                <span className="text-fog">BBox Format</span>
                <span className="text-brass">[x0, y0, x1, y1] High-DPI</span>
              </div>
            </div>

            {/* Bento Card 5: Technical Flashcards & Study Mode (4 cols) */}
            <div className="lg:col-span-4 p-6 sm:p-7 rounded-3xl glass-card holo-card border border-violet/25 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="p-2 rounded-xl bg-violet/15 text-violet border border-violet/30">
                    <BookOpen size={18} />
                  </span>
                  <span className="font-data-mono text-xs text-fog">STUDY MODE</span>
                </div>
                <h3 className="font-ui font-semibold text-lg text-parchment mb-2">
                  Interactive Flashcards & Quizzes
                </h3>
                <p className="font-body text-fog text-xs leading-relaxed mb-4">
                  Automatically synthesize technical quizzes and flipped flashcards directly from
                  uploaded specifications to train engineering staff and certify compliance.
                </p>
              </div>

              <button
                onClick={() => scrollToSection("study")}
                className="w-full py-2.5 rounded-xl bg-brass/15 hover:bg-brass text-brass hover:text-white font-semibold text-xs font-ui transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-brass/25"
              >
                <span>Launch Study & Quiz Mode</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
          </Reveal>
        </section>

        {/* Technical Architecture Pipeline Diagram Section */}
        <section id="architecture" className="space-y-6 pt-4 scroll-mt-24">
          <Reveal>
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan/10 border border-cyan/30 text-[11px] font-data-mono text-cyan">
              <Workflow size={12} />
              <span>Full System Architecture</span>
            </div>
            <h2 className="font-hero text-3xl sm:text-4xl text-parchment font-semibold">
              The DocuMind AI Engineering Stack
            </h2>
            <p className="font-body text-fog text-sm sm:text-base">
              Dual-layer hybrid retrieval combining dense vector similarity with sparse BM25 keyword matching,
              orchestrated via FastAPI and rendered on a hardware-accelerated React interface.
            </p>
          </div>
          </Reveal>

          <Reveal delay={0.05} amount={0.05}>
          <div className="p-6 sm:p-8 rounded-3xl glass-card holo-card border border-fog/15 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
              {[
                {
                  step: "01. Ingest",
                  title: "PyMuPDF Page Split",
                  desc: "Retains precise layout bounding boxes, table lines & cropped image diagrams.",
                  color: "text-brass",
                  borderColor: "border-brass/40",
                },
                {
                  step: "02. Embed",
                  title: "Dense & Sparse Index",
                  desc: "MiniLM-L6-v2 vector embeddings stored in local ChromaDB + BM25 inverted index.",
                  color: "text-cyan",
                  borderColor: "border-cyan/40",
                },
                {
                  step: "03. Rerank",
                  title: "Reciprocal Rank Fusion",
                  desc: "Merges semantic concepts with exact numerical part number matches (k = 60).",
                  color: "text-violet",
                  borderColor: "border-violet/40",
                },
                {
                  step: "04. Vision",
                  title: "Multimodal OCR",
                  desc: "The configured vision model reads circuit schematics and extracted CAD figures.",
                  color: "text-moss",
                  borderColor: "border-moss/40",
                },
                {
                  step: "05. Ground",
                  title: "Streaming SSE Answer",
                  desc: "Sub-second token streaming with verified bounding box citation links.",
                  color: "text-brass",
                  borderColor: "border-brass/40",
                },
              ].map((stage, idx) => (
                <div
                  key={idx}
                  className={`holo-card p-4 rounded-2xl bg-ink/80 border ${stage.borderColor} flex flex-col justify-between space-y-2 transition-all hover:-translate-y-1`}
                >
                  <div>
                    <span className="text-[10px] font-data-mono text-fog uppercase">
                      {stage.step}
                    </span>
                    <h4 className={`text-sm font-semibold font-ui mt-1 ${stage.color}`}>
                      {stage.title}
                    </h4>
                  </div>
                  <p className="text-fog text-[11px] font-body leading-relaxed">
                    {stage.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Quick Architecture Callout Footer */}
            <div className="pt-4 border-t border-fog/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-data-mono text-fog">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-parchment">
                  <Database size={13} className="text-cyan" /> ChromaDB Vector Store
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-parchment">
                  <Zap size={13} className="text-brass" /> Groq Fallback
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-parchment">
                  <ShieldCheck size={13} className="text-moss" /> Ollama Local Model
                </span>
              </div>
              <button
                onClick={() => scrollToSection("library")}
                className="text-brass hover:text-parchment flex items-center gap-1 font-semibold transition-colors"
              >
                <span>Upload a Technical Manual Now</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
          </Reveal>
        </section>

        {/* Bottom CTA Banner */}
        <Reveal amount={0.12}>
        <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#2a2a2d]/95 via-ink to-[#2a2a2d]/85 border border-brass/25 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.5),0_0_30px_-5px_rgba(225,6,0,0.08)] relative overflow-hidden text-center space-y-5">
          <div className="absolute inset-0 cta-grid opacity-50 pointer-events-none" aria-hidden="true" />
          <motion.div
            className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-brass/20 blur-[100px] pointer-events-none"
            animate={reduceMotion ? undefined : { x: [0, -34, 14, 0], y: [0, 22, -12, 0], scale: [1, 1.2, 1.06, 1] }}
            transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden="true"
          />
          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <h2 className="font-hero text-3xl sm:text-5xl text-parchment font-semibold">
              Ready to interrogate your engineering manuals?
            </h2>
            <p className="font-body text-fog text-sm sm:text-base">
              Upload your PDF technical specifications and start asking complex multi-page questions with sub-pixel citation proof.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
              <Magnetic
                onClick={() => scrollToSection("chat")}
                className="btn-signal group px-7 py-4 rounded-xl font-ui text-white shadow-xl shadow-brass/35 flex items-center gap-2"
              >
                <span>Launch Engineering Workspace</span>
                <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Magnetic>

              <button
                onClick={() => scrollToSection("library")}
                className="px-6 py-4 bg-indigo hover:bg-indigo/80 text-parchment border border-fog/20 rounded-xl font-ui hover:border-brass/40 transition-all flex items-center gap-2"
              >
                <BookOpen size={17} className="text-brass" />
                <span>Open Document Library</span>
              </button>
            </div>
          </div>
        </section>
        </Reveal>
      </main>

      {/* Global Marquee & Footer */}
      <footer className="mt-auto border-t border-fog/8 bg-gradient-to-b from-ink/95 to-ink">
        <Marquee />
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-data-mono text-fog">
          <div className="flex items-center gap-3">
            <span className="text-parchment font-semibold">DocuMind AI v2.5</span>
            <span>•</span>
            <span>Multimodal Engineering RAG</span>
            <span>•</span>
            <span className="text-brass">Local-First Privacy Mode</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-indigo border border-fog/20 text-[10px] text-brass">
                ⌘K
              </kbd>
              <span>Command Palette</span>
            </span>
            <button
              onClick={() => scrollToSection("home")}
              className="hover:text-parchment transition-colors"
            >
              Back to Top &uarr;
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
