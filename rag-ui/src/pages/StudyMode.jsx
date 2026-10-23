import { useState, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  Sparkles,
  Brain,
  Award,
} from "lucide-react";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import { API_BASE } from "../config";

function Flashcard({ card, onSwipe }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (e, info) => {
    if (info.offset.x > 100) {
      onSwipe("right");
      setIsFlipped(false);
    } else if (info.offset.x < -100) {
      onSwipe("left");
      setIsFlipped(false);
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity, perspective: 1000 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      className="w-full max-w-md h-88 cursor-grab active:cursor-grabbing mx-auto relative select-none"
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-full h-full relative preserve-3d"
        style={{ transformStyle: "preserve-3d" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Front */}
        <div className="absolute inset-0 glass-card bg-gradient-to-br from-indigo/90 to-ink p-7 rounded-3xl flex flex-col items-center justify-between text-center backface-hidden shadow-2xl border border-brass/30">
          <div className="flex items-center justify-between w-full">
            <span className="px-2.5 py-1 rounded-full bg-brass/15 text-brass text-[10px] font-data-mono uppercase tracking-wider border border-brass/30">
              Technical Concept
            </span>
            <span className="text-xs font-data-mono text-fog">Click to Flip ↺</span>
          </div>

          <div className="my-auto px-2">
            <h3 className="font-hero text-xl sm:text-2xl text-parchment leading-snug">
              {card.front}
            </h3>
          </div>

          <div className="w-full pt-4 border-t border-fog/10 flex items-center justify-between text-xs font-ui-label text-fog">
            <span>← Swipe Left: Needs Work</span>
            <span className="text-brass">Swipe Right: Mastered →</span>
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 bg-indigo p-7 rounded-3xl flex flex-col items-center justify-between text-center backface-hidden shadow-2xl border border-brass/40"
          style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
        >
          <div className="flex items-center justify-between w-full">
            <span className="px-2.5 py-1 rounded-full bg-moss/20 text-moss text-[10px] font-data-mono uppercase tracking-wider border border-moss/30">
              Verified Evidence
            </span>
            <span className="text-xs font-data-mono text-fog">Click to Flip ↺</span>
          </div>

          <div className="my-auto overflow-y-auto max-h-44 px-1">
            <p className="font-body text-parchment text-sm sm:text-base leading-relaxed">
              {card.back}
            </p>
            {card.source && (
              <div className="font-data-mono text-[11px] text-brass/80 mt-3 p-2 rounded-lg bg-ink/50 border border-fog/10">
                📄 {card.source}
              </div>
            )}
          </div>

          <div className="w-full pt-3 border-t border-fog/10 flex justify-between gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwipe("left");
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-ink/60 hover:bg-rust/20 text-fog hover:text-rust text-xs font-ui-label transition-colors border border-fog/10"
            >
              Needs Work
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwipe("right");
              }}
              className="btn-signal flex-1 py-2 px-3 rounded-xl text-white text-xs font-semibold font-ui-label transition-colors shadow-md"
            >
              Mastered ✓
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProgressDial({ current, total }) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg className="transform -rotate-90 w-16 h-16">
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-fog/20"
          fill="transparent"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-brass transition-all duration-300"
          fill="transparent"
        />
      </svg>
      <div className="absolute font-data-mono text-parchment text-xs font-semibold">
        {current}/{total}
      </div>
    </div>
  );
}

export function StudyMode() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isStudying, setIsStudying] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch(`${API_BASE}/documents`);
        if (res.ok) {
          const data = await res.json();
          setDocuments(data);
          if (data.length > 0) setSelectedDoc(data[0].name);
        }
      } catch (e) {
        console.error("Failed to fetch documents", e);
      }
    };
    fetchDocs();
    window.addEventListener("documentUpdated", fetchDocs);
    return () => window.removeEventListener("documentUpdated", fetchDocs);
  }, []);

  const generateDeck = async () => {
    if (!selectedDoc) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: selectedDoc,
          count: 5,
          kind: "flashcards",
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || "Could not generate a study deck.");
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("The model returned an empty study deck.");
      }
      setCards(data.map((c, i) => ({ ...c, id: i })));
      setCurrentIndex(0);
      setMasteredCount(0);
      setIsStudying(true);
    } catch (e) {
      console.error("Failed to generate study deck:", e);
      setError(e.message || "Could not generate a study deck.");
      toast.error(e.message || "Could not generate a study deck.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwipe = (direction) => {
    if (direction === "right") {
      setMasteredCount((prev) => prev + 1);
    }
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    if (nextIndex >= cards.length) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#e10600", "#c0c0c0", "#2a2a2a"],
      });
    }
  };

  if (!isStudying) {
    return (
      <div className="h-full flex flex-col p-6 sm:p-10 max-w-5xl mx-auto overflow-y-auto relative">
        {/* Ambient Atmospheric Glows */}
        <div className="absolute top-0 right-1/4 w-[600px] h-[400px] bg-brass/[0.05] rounded-full blur-[180px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[500px] h-[400px] bg-parchment/[0.03] rounded-full blur-[180px] pointer-events-none" />

        <header className="mb-8 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-brass/15 text-brass text-xs font-data-mono border border-brass/30 uppercase tracking-widest">
              Active Recall Trainer
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl text-parchment font-semibold tracking-tight">
            Active Recall <span className="font-serif italic font-normal text-[#e10600]">Study Mode</span>
          </h1>
          <p className="font-body text-fog text-sm sm:text-base max-w-xl mt-1 leading-relaxed">
            Generate context-grounded flashcards directly from indexed manuals and specifications. Test retention of safety tolerances and operational guidelines.
          </p>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center pb-20">
          <div className="w-full max-w-md glass-card p-7 rounded-3xl border border-brass/25 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-brass/10 border border-brass/30 text-brass">
                <Brain size={24} />
              </div>
              <div>
                <h3 className="font-ui font-semibold text-parchment">Generate Study Deck</h3>
                <p className="text-xs text-fog">Select document for active recall session</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-ui-label text-parchment uppercase tracking-wider text-xs block">
                Target Document
              </label>
              <select
                value={selectedDoc}
                onChange={(e) => setSelectedDoc(e.target.value)}
                className="w-full bg-ink/80 border border-fog/20 rounded-xl p-3 font-data-mono text-xs text-parchment focus:outline-none focus:border-brass cursor-pointer"
              >
                {documents.length === 0 && (
                  <option value="">No documents available</option>
                )}
                {documents.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name} ({d.pages || 0} pages)
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={generateDeck}
              disabled={!selectedDoc || isLoading}
              className="btn-signal w-full py-3.5 text-white font-semibold rounded-xl font-ui-label shadow-lg shadow-brass/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
            >
              <Sparkles size={16} />
              {isLoading ? "Analyzing and generating..." : "Generate Deck from Document"}
            </button>

            {error && (
              <p className="text-xs text-rust bg-rust/10 border border-rust/30 rounded-xl p-3">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 sm:p-10 max-w-4xl mx-auto overflow-y-auto">
      <header className="mb-6 flex justify-between items-center pb-4 border-b border-fog/10">
        <div>
          <h1 className="font-hero text-2xl sm:text-3xl text-parchment">
            Active Recall Session
          </h1>
          <p className="font-body text-fog text-xs sm:text-sm">
            Deck: <span className="text-brass font-data-mono">{selectedDoc || "Generated deck"}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo/50 border border-fog/15 text-xs font-data-mono text-fog">
            <Award size={14} className="text-brass" />
            <span>Mastered: {masteredCount}</span>
          </div>
          <ProgressDial current={currentIndex} total={cards.length} />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center pb-12">
        <AnimatePresence mode="popLayout">
          {currentIndex < cards.length ? (
            <motion.div
              key={cards[currentIndex].id}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full"
            >
              <Flashcard card={cards[currentIndex]} onSwipe={handleSwipe} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-8 glass-card rounded-3xl border border-brass/30 max-w-md w-full shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-brass/20 text-brass flex items-center justify-center mx-auto mb-4 border border-brass/40">
                <Award size={32} />
              </div>
              <h2 className="font-hero text-3xl text-parchment mb-2">
                Deck Completed!
              </h2>
              <p className="font-body text-fog text-sm mb-6">
                You reviewed all {cards.length} concepts. Mastered: {masteredCount}/{cards.length}.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setCurrentIndex(0);
                    setMasteredCount(0);
                  }}
                  className="btn-signal w-full py-3 text-white font-semibold rounded-xl font-ui-label transition-colors"
                >
                  Review Again
                </button>
                <button
                  onClick={() => setIsStudying(false)}
                  className="w-full py-2.5 bg-indigo/60 text-parchment rounded-xl font-ui-label text-xs hover:bg-indigo transition-colors"
                >
                  Choose Another Document
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
