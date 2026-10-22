import React, { useState, useEffect } from "react";
import {
  Compass,
  Book,
  MessageSquare,
  Layers,
  Map,
  Settings,
  GitCompare,
  Globe,
  Lock,
  Search,
  Command,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeSettings } from "./ThemeSettings";
import { useUI } from "../context/UIContext";

export function Rail({ activeView, onNavigate, onOpenCommandPalette }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const { privacyMode, setPrivacyMode } = useUI();

  const fetchDocCount = () => {
    fetch("/documents")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDocCount(data.length))
      .catch(() => {});
  };

  useEffect(() => {
    fetchDocCount();
    window.addEventListener("documentUpdated", fetchDocCount);
    return () => window.removeEventListener("documentUpdated", fetchDocCount);
  }, []);

  const links = [
    { id: "home", icon: Compass, label: "Home / Overview" },
    { id: "chat", icon: MessageSquare, label: "Chat & Reasoning" },
    { id: "library", icon: Book, label: "Document Library" },
    { id: "compare", icon: GitCompare, label: "Revision Diff" },
    { id: "map", icon: Map, label: "Knowledge Map" },
    { id: "study", icon: Layers, label: "Study Mode" },
  ];

  return (
    <>
      <nav className="w-full h-16 sm:w-16 sm:h-full border-t sm:border-t-0 sm:border-r border-fog/20 flex flex-row sm:flex-col items-center justify-around sm:justify-start sm:py-5 px-3 sm:px-0 gap-1.5 sm:gap-4 shrink-0 bg-[#2a2a2a] z-40 select-none shadow-xl">
        {/* App Logo */}
        <button
          onClick={() => onNavigate("home")}
          className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center mb-2 hidden sm:flex hover:scale-105 transition-transform ring-2 ring-brass/30 hover:ring-brass/70 shadow-md shadow-brass/15"
          title="DocuMind AI Home"
        >
          <img src="/logo.svg" alt="DocuMind AI Logo" className="w-full h-full object-cover" />
        </button>

        {/* Command Palette Trigger in Rail */}
        <button
          onClick={onOpenCommandPalette}
          className="group relative w-11 h-11 hidden sm:flex items-center justify-center rounded-xl text-fog hover:text-parchment hover:bg-indigo/50 transition-all border border-transparent hover:border-fog/20 mb-1"
          title="Command Palette (⌘K)"
        >
          <Search size={18} className="group-hover:text-brass transition-colors" />
          <div className="absolute left-full ml-3 px-2.5 py-1 bg-indigo/95 backdrop-blur text-parchment text-xs font-ui-label rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-xl border border-fog/15 z-50 flex items-center gap-1.5">
            <span>Quick Launcher</span>
            <kbd className="px-1 py-0.2 rounded bg-ink text-[10px] text-brass">⌘K</kbd>
          </div>
        </button>

        <div className="w-8 h-px bg-fog/15 hidden sm:block mb-1" />

        {/* Navigation Links */}
        {links.map((link) => {
          const isActive = activeView === link.id;
          const Icon = link.icon;
          return (
            <button
              key={link.id}
              onClick={() => onNavigate(link.id)}
              className={`group relative w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
                isActive
                  ? "text-brass bg-brass/15 border border-brass/50 shadow-lg shadow-brass/25"
                  : "text-fog hover:text-parchment hover:bg-white/5"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />

              {link.id === "library" && docCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-brass text-white rounded-full text-[9px] font-bold flex items-center justify-center font-data-mono shadow-md">
                  {docCount}
                </span>
              )}

              {isActive && (
                <motion.div
                  layoutId="rail-indicator"
                  className="absolute inset-0 border border-brass/60 rounded-xl pointer-events-none"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2.5 py-1 bg-indigo/95 backdrop-blur text-parchment text-xs font-ui-label rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-xl border border-fog/15 hidden sm:block z-50">
                {link.label}
              </div>
            </button>
          );
        })}

        {/* Rail Bottom Action Buttons */}
        <div className="mt-auto hidden sm:flex flex-col items-center gap-2.5">
          {/* Quick Mode Indicator / Toggle */}
          <button
            onClick={() => setPrivacyMode(privacyMode === "private" ? "normal" : "private")}
            className={`group relative w-11 h-11 flex items-center justify-center rounded-xl transition-all border overflow-hidden cursor-pointer ${
              privacyMode === "private"
                ? "bg-brass/20 border-brass/60 text-brass hover:bg-brass/30 shadow-lg shadow-brass/25 scale-100"
                : "bg-white/5 border-fog/30 text-parchment hover:bg-white/10 shadow-lg shadow-black/20"
            }`}
          >
            {/* Shockwave expanding ring upon switch */}
            <AnimatePresence>
              <motion.span
                key={`shockwave-${privacyMode}`}
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: 2.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={`absolute inset-0 rounded-xl pointer-events-none border ${
                  privacyMode === "private" ? "border-brass" : "border-silver"
                }`}
              />
            </AnimatePresence>

            {/* Icon Morph Animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={privacyMode}
                initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 450, damping: 22 }}
              >
                {privacyMode === "private" ? (
                  <Lock size={18} className="text-brass drop-shadow-[0_0_8px_rgba(225,6,0,0.5)]" />
                ) : (
                  <Globe size={18} className="text-parchment" />
                )}
              </motion.div>
            </AnimatePresence>

            <span
              className={`absolute top-1 right-1 w-2 h-2 rounded-full transition-colors duration-300 ${
                privacyMode === "private" ? "bg-brass shadow-[0_0_6px_#e10600] animate-pulse" : "bg-[#c0c0c0]"
              }`}
            />
            <div className="absolute left-full ml-3 px-3 py-1.5 bg-indigo/95 backdrop-blur text-parchment text-xs font-ui-label rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-xl border border-fog/15 z-50">
              <div className="font-semibold text-parchment flex items-center gap-1.5">
                {privacyMode === "private" ? (
                  <>
                    <Lock size={12} className="text-brass" />
                    <span>Private Mode (Local-First)</span>
                  </>
                ) : (
                  <>
                    <Globe size={12} className="text-parchment" />
                    <span>Normal Mode (Hybrid Cloud)</span>
                  </>
                )}
              </div>
              <div className="text-[10px] text-fog mt-0.5">Click to toggle privacy engine</div>
            </div>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="group relative w-11 h-11 flex items-center justify-center rounded-xl transition-all text-fog hover:text-parchment hover:bg-indigo/40"
          >
            <Settings
              size={20}
              strokeWidth={2}
              className="group-hover:rotate-45 transition-transform duration-300"
            />
            <div className="absolute left-full ml-3 px-2.5 py-1 bg-indigo/95 backdrop-blur text-parchment text-xs font-ui-label rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-xl border border-fog/15 z-50">
              Appearance & Engine Settings
            </div>
          </button>
        </div>
      </nav>

      <ThemeSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
