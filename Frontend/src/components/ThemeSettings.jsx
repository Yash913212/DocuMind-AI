import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Check, User, Database, Layers, Globe, Lock } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useUI } from "../context/UIContext";
import { API_BASE } from "../config";

export function ThemeSettings({ isOpen, onClose }) {
  const { themeMode, triggerThemeTransition, accent, setAccent } = useTheme();
  const { privacyMode, setPrivacyMode, isModeLoading, documents } = useUI();
  const [vectorBackend, setVectorBackend] = useState("supabase");

  const stats = React.useMemo(() => ({
    docs: documents.length,
    chunks: documents.reduce((acc, doc) => acc + (doc.chunks || 0), 0)
  }), [documents]);

  useEffect(() => {
    if (isOpen) {
      fetch(`${API_BASE}/system/architecture`)
        .then(res => (res.ok ? res.json() : null))
        .then(arch => {
          if (arch?.vector_backend) {
            setVectorBackend(arch.vector_backend);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const accents = [
    { id: "red", name: "Signal Red", color: "bg-[#E10600]" },
    { id: "silver", name: "Silver", color: "bg-[#C0C0C0]" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-24 left-4 sm:bottom-4 sm:left-20 z-50 w-72 bg-indigo text-parchment p-6 rounded-xl border border-brass/20 shadow-2xl"
          >
            <h3 className="font-hero text-xl text-brass mb-4">Settings</h3>

            <div className="mb-5 bg-ink/50 p-4 rounded-xl border border-fog/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brass/20 flex items-center justify-center text-brass">
                  <User size={20} />
                </div>
                <div>
                  <div className="font-ui-label text-parchment font-medium">Guest User</div>
                  <div className="font-data-mono text-fog text-[10px] uppercase">Local Workspace</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-fog/10">
                <div className="flex flex-col items-center p-2 bg-ink rounded-lg border border-fog/5">
                  <Database size={14} className="text-moss mb-1" />
                  <span className="font-data-mono text-sm text-parchment">{stats.docs}</span>
                  <span className="font-ui-label text-[10px] text-fog uppercase tracking-widest mt-1">Docs</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-ink rounded-lg border border-fog/5">
                  <Layers size={14} className="text-rust mb-1" />
                  <span className="font-data-mono text-sm text-parchment">{stats.chunks}</span>
                  <span className="font-ui-label text-[10px] text-fog uppercase tracking-widest mt-1">Chunks</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-fog/10 flex items-center justify-between text-xs">
                <span className="text-fog flex items-center gap-1.5 font-ui-label text-[11px]">
                  <Database size={12} className="text-brass" /> Vector DB
                </span>
                <span className="font-data-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-semibold flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {vectorBackend === "supabase" ? "Supabase pgvector" : "ChromaDB Local"}
                </span>
              </div>
            </div>

            {/* Privacy Mode Toggle */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-ui-label text-xs uppercase tracking-widest text-fog">
                  Engine Mode
                </div>
                {isModeLoading && (
                  <span className="text-[10px] text-brass animate-pulse">Switching...</span>
                )}
              </div>
              <div className="flex bg-ink p-1 rounded-lg mb-2 border border-fog/10 relative">
                <button
                  onClick={() => setPrivacyMode("normal")}
                  disabled={isModeLoading}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md font-ui-label text-xs transition-colors z-10 cursor-pointer ${
                    privacyMode === "normal"
                      ? "text-parchment font-semibold"
                      : "text-fog hover:text-parchment"
                  }`}
                >
                  {privacyMode === "normal" && (
                    <motion.div
                      layoutId="privacyModePill"
                      className="absolute inset-0 bg-indigo rounded-md border border-fog/30 shadow -z-10"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <Globe size={13} /> Normal
                </button>
                <button
                  onClick={() => setPrivacyMode("private")}
                  disabled={isModeLoading}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md font-ui-label text-xs transition-colors z-10 cursor-pointer ${
                    privacyMode === "private"
                      ? "text-white font-semibold"
                      : "text-fog hover:text-parchment"
                  }`}
                >
                  {privacyMode === "private" && (
                    <motion.div
                      layoutId="privacyModePill"
                      className="absolute inset-0 bg-[#e10600] rounded-md border border-[#ff453a]/40 shadow-lg shadow-[#e10600]/30 -z-10"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <Lock size={13} /> Private
                </button>
              </div>
              <p className="text-[10px] text-fog/80 leading-relaxed">
                {privacyMode === "private"
                  ? "🔒 Local-first: prefers Ollama + local vector DB. Web search disabled; Groq fallback only if Ollama is unavailable."
                  : "🌐 Normal: Multimodal RAG with cloud fallback chains & web augmentation."}
              </p>
            </div>

            <div className="mb-6">
              <div className="font-ui-label text-xs uppercase tracking-widest text-fog mb-3">
                Palette & Appearance
              </div>
              <div className="flex bg-ink p-1 rounded-lg border border-fog/10">
                <button
                  onClick={(e) => triggerThemeTransition("light", e)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md font-ui-label text-xs transition-colors cursor-pointer ${
                    themeMode === "light"
                      ? "bg-indigo text-brass shadow border border-brass/30 font-semibold"
                      : "text-fog hover:text-parchment"
                  }`}
                >
                  <Sun size={15} /> Moonlit Silver
                </button>
                <button
                  onClick={(e) => triggerThemeTransition("dark", e)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md font-ui-label text-xs transition-colors cursor-pointer ${
                    themeMode === "dark"
                      ? "bg-indigo text-brass shadow border border-brass/30 font-semibold"
                      : "text-fog hover:text-parchment"
                  }`}
                >
                  <Moon size={15} /> Charcoal Noir
                </button>
              </div>
            </div>

            <div>
              <div className="font-ui-label text-xs uppercase tracking-widest text-fog mb-3">
                Precision Accent Color
              </div>
              <div className="flex items-center gap-3">
                {accents.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setAccent(item.id)}
                    className="group relative flex items-center justify-center w-10 h-10 rounded-full bg-ink hover:bg-ink/80 transition-colors border border-fog/15"
                    title={item.name}
                  >
                    <div
                      className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm`}
                    >
                      {accent === item.id && (
                        <Check size={14} className="text-white" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
