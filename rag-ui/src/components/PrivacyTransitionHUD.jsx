import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Globe, ShieldCheck, Cpu, HardDrive, WifiOff, CloudLightning, Activity } from "lucide-react";
import { useUI } from "../context/UIContext";

export function PrivacyTransitionHUD() {
  const { modeTransition, dismissModeTransition } = useUI();

  // Keyboard shortcut listener for instant Escape dismissal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && modeTransition) {
        dismissModeTransition();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modeTransition, dismissModeTransition]);

  const isPrivate = modeTransition?.toMode === "private";

  return (
    <AnimatePresence>
      {modeTransition && (
        <motion.div
          key={modeTransition.id || "privacy-transition-overlay"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={dismissModeTransition}
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 select-none cursor-pointer"
          role="dialog"
          aria-label="Security Mode Transition"
        >
          {/* Full-Screen Backdrop & Peripheral Edge Glow */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`absolute inset-0 backdrop-blur-md transition-colors duration-500 ${
              isPrivate
                ? "bg-[#121214]/80 shadow-[inset_0_0_120px_rgba(225,6,0,0.38)]"
                : "bg-[#121214]/80 shadow-[inset_0_0_120px_rgba(192,192,192,0.26)]"
            }`}
          />

          {/* Cyber-Matrix Scan Grid Background */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 0.12, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`absolute inset-0 pointer-events-none [background-size:24px_24px] ${
              isPrivate
                ? "bg-[radial-gradient(#e10600_1px,transparent_1px)]"
                : "bg-[radial-gradient(#c0c0c0_1px,transparent_1px)]"
            }`}
          />

          {/* Central HUD Modal */}
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.82, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -18 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className={`relative max-w-md w-full rounded-3xl p-6 sm:p-8 overflow-hidden text-center backdrop-blur-2xl bg-[#1d1d20]/95 shadow-2xl transition-all ${
              isPrivate
                ? "border border-[#e10600]/40 shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_45px_rgba(225,6,0,0.3)]"
                : "border border-[#c0c0c0]/30 shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_45px_rgba(192,192,192,0.2)]"
            }`}
          >
            {/* Laser Scanning Beam */}
            <motion.div
              initial={{ top: "-10%", opacity: 0 }}
              animate={{ top: "110%", opacity: [0, 0.9, 0.9, 0] }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className={`absolute left-0 right-0 h-[2px] pointer-events-none z-30 ${
                isPrivate
                  ? "bg-gradient-to-r from-transparent via-[#e10600] to-transparent shadow-[0_0_12px_#e10600]"
                  : "bg-gradient-to-r from-transparent via-[#c0c0c0] to-transparent shadow-[0_0_12px_#c0c0c0]"
              }`}
            />

            {/* Top Pill Status Badge */}
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-data-mono uppercase tracking-wider mb-5 border ${
                isPrivate
                  ? "bg-[#e10600]/15 text-[#ff453a] border-[#e10600]/35 shadow-sm shadow-[#e10600]/20"
                  : "bg-white/10 text-parchment border-white/20 shadow-sm"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isPrivate ? "bg-[#e10600] animate-ping" : "bg-cyan animate-pulse"
                }`}
              />
              <span>
                {isPrivate ? "Air-Gapped Vault Active" : "Hybrid Cloud Mesh Active"}
              </span>
            </motion.div>

            {/* Central Animated Icon Portal */}
            <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
              {/* Concentric Shockwave Rings */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: [1, 1.45, 1.6], opacity: [0.7, 0.2, 0] }}
                transition={{ duration: 1.4, ease: "easeOut", repeat: Infinity }}
                className={`absolute inset-0 rounded-full border ${
                  isPrivate ? "border-[#e10600]/60" : "border-[#c0c0c0]/50"
                }`}
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0.9 }}
                animate={{ scale: [0.8, 1.25, 1.4], opacity: [0.9, 0.3, 0] }}
                transition={{ duration: 1.4, ease: "easeOut", delay: 0.2, repeat: Infinity }}
                className={`absolute inset-0 rounded-full border ${
                  isPrivate ? "border-[#e10600]/40" : "border-[#c0c0c0]/30"
                }`}
              />

              {/* Core Icon Capsule */}
              <motion.div
                initial={{ scale: 0.5, rotate: isPrivate ? -20 : -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 18 }}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl z-10 border ${
                  isPrivate
                    ? "bg-gradient-to-br from-[#e10600]/25 to-[#2a2a2a] border-[#e10600]/60 text-[#ff453a] shadow-[#e10600]/30"
                    : "bg-gradient-to-br from-white/15 to-[#2a2a2a] border-white/30 text-parchment shadow-black/40"
                }`}
              >
                {isPrivate ? (
                  <Lock size={30} className="stroke-[2.2]" />
                ) : (
                  <Globe size={30} className="stroke-[2.2] animate-spin-slow" />
                )}
              </motion.div>
            </div>

            {/* Title & Description */}
            <motion.h3
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-2xl font-bold font-hero tracking-tight text-white mb-2"
            >
              {isPrivate ? "Air-Gapped Vault Enforced" : "Hybrid Cloud Mesh Connected"}
            </motion.h3>

            <motion.p
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xs sm:text-sm font-body text-fog mb-6 leading-relaxed max-w-sm mx-auto"
            >
              {isPrivate
                ? "All data egress is strictly blocked. Ingestion, embeddings, and generative reasoning are 100% contained on your local machine."
                : "Multimodal cloud-augmented pipelines enabled. High-throughput synthesis, cross-document verification, and web search active."}
            </motion.p>

            {/* Security Telemetry Specs Matrix */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="grid grid-cols-1 gap-2 text-left mb-5"
            >
              {isPrivate ? (
                <>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-data-mono text-parchment">
                    <WifiOff size={14} className="text-[#e10600] shrink-0" />
                    <span className="text-fog">Cloud Egress:</span>
                    <span className="font-semibold text-[#ff453a] ml-auto">0% (Blocked)</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-data-mono text-parchment">
                    <Cpu size={14} className="text-[#e10600] shrink-0" />
                    <span className="text-fog">Inference Engine:</span>
                    <span className="font-semibold text-parchment ml-auto">Local Ollama</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-data-mono text-parchment">
                    <HardDrive size={14} className="text-[#e10600] shrink-0" />
                    <span className="text-fog">Vector Database:</span>
                    <span className="font-semibold text-parchment ml-auto">Local ChromaDB</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-data-mono text-parchment">
                    <CloudLightning size={14} className="text-cyan shrink-0" />
                    <span className="text-fog">Inference Speed:</span>
                    <span className="font-semibold text-parchment ml-auto">Hardware Turbo</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-data-mono text-parchment">
                    <ShieldCheck size={14} className="text-cyan shrink-0" />
                    <span className="text-fog">RAG Accuracy:</span>
                    <span className="font-semibold text-parchment ml-auto">Dual-Stream RRF</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-data-mono text-parchment">
                    <Activity size={14} className="text-cyan shrink-0" />
                    <span className="text-fog">Search Scope:</span>
                    <span className="font-semibold text-parchment ml-auto">Global + Local</span>
                  </div>
                </>
              )}
            </motion.div>

            {/* Quick Dismiss Indicator */}
            <div className="flex items-center justify-center gap-2 text-[10px] font-data-mono text-fog/70">
              <span>Click anywhere or press Esc to dismiss</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
