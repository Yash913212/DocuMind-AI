import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Compass,
  MessageSquare,
  Book,
  GitCompare,
  Map,
  Layers,
  Lock,
  Globe,
  Sun,
  Moon,
  Upload,
  Palette,
  ExternalLink,
  Command,
  ArrowRight,
  Check,
  Brain,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useUI } from "../context/UIContext";

export function CommandPalette({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { themeMode, setThemeMode, accent, setAccent } = useTheme();
  const { privacyMode, setPrivacyMode } = useUI();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const navigationCommands = [
    {
      id: "nav-home",
      title: "Go to Home / Overview",
      category: "Navigation",
      icon: Compass,
      shortcut: "H",
      action: () => onNavigate("home"),
    },
    {
      id: "nav-chat",
      title: "Open Engineering Chat & Q&A",
      category: "Navigation",
      icon: MessageSquare,
      shortcut: "C",
      action: () => onNavigate("chat"),
    },
    {
      id: "nav-library",
      title: "Open Document Library & Upload",
      category: "Navigation",
      icon: Book,
      shortcut: "L",
      action: () => onNavigate("library"),
    },
    {
      id: "nav-compare",
      title: "Open Revision Comparator (Diff Specs)",
      category: "Navigation",
      icon: GitCompare,
      shortcut: "D",
      action: () => onNavigate("compare"),
    },
    {
      id: "nav-map",
      title: "Explore 3D Knowledge Map",
      category: "Navigation",
      icon: Map,
      shortcut: "M",
      action: () => onNavigate("map"),
    },
    {
      id: "nav-study",
      title: "Launch Study Mode & Technical Flashcards",
      category: "Navigation",
      icon: Layers,
      shortcut: "S",
      action: () => onNavigate("study"),
    },
    {
      id: "nav-nlp",
      title: "NLP Intelligence Lab (Tokenization, Intent, RRF)",
      category: "Navigation",
      icon: Brain,
      shortcut: "N",
      action: () => {
        onNavigate("home");
        setTimeout(() => {
          document.getElementById("nlp-lab")?.scrollIntoView({ behavior: "smooth" });
        }, 150);
      },
    },
  ];

  const actionCommands = [
    {
      id: "action-privacy",
      title:
        privacyMode === "private"
          ? "Switch to Normal Cloud Mode"
          : "Switch to Private Mode (Local-First)",
      category: "Security & AI Mode",
      icon: privacyMode === "private" ? Globe : Lock,
      badge: privacyMode === "private" ? "Private Active" : "Hybrid Cloud",
      action: () => {
        setPrivacyMode(privacyMode === "private" ? "normal" : "private");
      },
    },
    {
      id: "action-theme",
      title: themeMode === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme",
      category: "Appearance",
      icon: themeMode === "dark" ? Sun : Moon,
      action: () => setThemeMode(themeMode === "dark" ? "light" : "dark"),
    },
    {
      id: "accent-brass",
      title: "Accent Color: Imperial Brass",
      category: "Appearance",
      icon: Palette,
      badge: accent === "brass" ? "Active" : undefined,
      action: () => setAccent("brass"),
    },
    {
      id: "accent-cyan",
      title: "Accent Color: Cyber Cyan",
      category: "Appearance",
      icon: Palette,
      badge: accent === "cyan" ? "Active" : undefined,
      action: () => setAccent("cyan"),
    },
    {
      id: "accent-moss",
      title: "Accent Color: Emerald Moss",
      category: "Appearance",
      icon: Palette,
      badge: accent === "moss" ? "Active" : undefined,
      action: () => setAccent("moss"),
    },
    {
      id: "accent-rust",
      title: "Accent Color: Rust Amber",
      category: "Appearance",
      icon: Palette,
      badge: accent === "rust" ? "Active" : undefined,
      action: () => setAccent("rust"),
    },
  ];

  const allCommands = [...navigationCommands, ...actionCommands];

  const filteredCommands = allCommands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/75 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative w-full max-w-xl bg-indigo/95 border border-brass/30 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl z-50 text-parchment"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-fog/15 bg-ink/40">
              <Search size={18} className="text-brass shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command or jump to view..."
                className="w-full bg-transparent text-sm text-parchment placeholder:text-fog/60 focus:outline-none font-ui"
              />
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-ink/80 border border-fog/20 text-[10px] font-data-mono text-fog shrink-0">
                <span>ESC</span>
              </div>
            </div>

            {/* Command List */}
            <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-fog font-ui">
                  No matching actions or destinations found.
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all ${
                        isSelected
                          ? "bg-brass/15 text-parchment border border-brass/40 shadow-sm"
                          : "text-fog hover:text-parchment hover:bg-ink/30 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isSelected
                              ? "bg-brass/20 border-brass/50 text-brass"
                              : "bg-ink/60 border-fog/10 text-fog"
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div>
                          <div
                            className={`text-xs font-medium font-ui ${
                              isSelected ? "text-parchment" : "text-parchment/90"
                            }`}
                          >
                            {cmd.title}
                          </div>
                          <div className="text-[10px] text-fog/70 font-data-mono">
                            {cmd.category}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {cmd.badge && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-data-mono bg-brass/10 border border-brass/30 text-brass">
                            {cmd.badge}
                          </span>
                        )}
                        {cmd.shortcut && (
                          <span className="px-1.5 py-0.5 rounded bg-ink/70 border border-fog/20 text-[10px] font-data-mono text-fog">
                            {cmd.shortcut}
                          </span>
                        )}
                        {isSelected && (
                          <ArrowRight size={13} className="text-brass ml-1" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Navigation Help */}
            <div className="px-4 py-2.5 bg-ink/60 border-t border-fog/10 flex items-center justify-between text-[11px] text-fog font-data-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-indigo border border-fog/20 text-[9px]">
                    ↑
                  </kbd>
                  <kbd className="px-1 py-0.5 rounded bg-indigo border border-fog/20 text-[9px]">
                    ↓
                  </kbd>{" "}
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-indigo border border-fog/20 text-[9px]">
                    ↵
                  </kbd>{" "}
                  Select
                </span>
              </div>
              <span className="text-brass/80">DocuMind AI Command Center</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
