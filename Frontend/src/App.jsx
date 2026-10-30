import React, { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Rail } from "./components/Rail";
import { Inspector } from "./components/Inspector";
import { CommandPalette } from "./components/CommandPalette";
import { UIProvider, useUI } from "./context/UIContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Toaster } from "react-hot-toast";
import { CinematicLayer } from "./components/CinematicFX";
import { PrivacyTransitionHUD } from "./components/PrivacyTransitionHUD";
import { ThemeTransitionOverlay } from "./components/ThemeTransitionOverlay";

const Landing = lazy(() => import("./pages/Landing").then((m) => ({ default: m.Landing })));
const Chat = lazy(() => import("./pages/Chat").then((m) => ({ default: m.Chat })));
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
const Compare = lazy(() => import("./pages/Compare").then((m) => ({ default: m.Compare })));
const KnowledgeMap = lazy(() => import("./pages/KnowledgeMap").then((m) => ({ default: m.KnowledgeMap })));
const StudyMode = lazy(() => import("./pages/StudyMode").then((m) => ({ default: m.StudyMode })));

const VALID_VIEWS = ["home", "chat", "library", "compare", "map", "study"];

function AppContent() {
  const { inspectorOpen, inspectorContent, closeInspector } = useUI();
  const [activeView, setActiveView] = useState(() => {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    const pathname = window.location.pathname.replace("/", "").toLowerCase();
    if (VALID_VIEWS.includes(hash)) return hash;
    if (VALID_VIEWS.includes(pathname)) return pathname;
    return "home";
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  // Synchronize browser history / URL hash
  const navigateTo = (viewId) => {
    if (VALID_VIEWS.includes(viewId)) {
      setActiveView(viewId);
      window.location.hash = viewId;
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (VALID_VIEWS.includes(hash)) {
        setActiveView(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Global ⌘K or Ctrl+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const pageVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.12 } },
        exit: { opacity: 0, transition: { duration: 0.08 } },
      }
    : {
        initial: { opacity: 0, y: 6 },
        animate: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
        },
        exit: {
          opacity: 0,
          y: -4,
          transition: { duration: 0.1, ease: "easeOut" },
        },
      };

  return (
    <div className="flex flex-col-reverse sm:flex-row h-[100dvh] bg-ink text-parchment overflow-hidden">
      <Rail
        activeView={activeView}
        onNavigate={navigateTo}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col">
        <AnimatePresence>
          <motion.div
            key={`page-sweep-${activeView}`}
            className="pointer-events-none absolute inset-x-0 top-0 z-[45] h-0.5 origin-left bg-gradient-to-r from-transparent via-brass to-transparent transform-gpu"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: [0, 1, 0] }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          />
        </AnimatePresence>

        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center bg-ink">
              <div className="flex flex-col items-center gap-3 select-none">
                <div className="w-7 h-7 rounded-full border-2 border-brass/20 border-t-brass animate-spin" />
                <span className="text-[11px] font-data-mono text-fog uppercase tracking-wider animate-pulse">Loading View...</span>
              </div>
            </div>
          }
        >
          <AnimatePresence mode="wait">
            {activeView === "home" && (
              <motion.div
                key="home"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full w-full overflow-hidden transform-gpu"
              >
              <Landing
                onNavigate={navigateTo}
                onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              />
            </motion.div>
          )}

          {activeView === "chat" && (
            <motion.div
              key="chat"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full w-full overflow-hidden transform-gpu"
            >
              <Chat />
            </motion.div>
          )}

          {activeView === "library" && (
            <motion.div
              key="library"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full w-full overflow-hidden transform-gpu"
            >
              <Library onNavigateToChat={() => navigateTo("chat")} />
            </motion.div>
          )}

          {activeView === "compare" && (
            <motion.div
              key="compare"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full w-full overflow-hidden transform-gpu"
            >
              <Compare />
            </motion.div>
          )}

          {activeView === "map" && (
            <motion.div
              key="map"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full w-full overflow-hidden transform-gpu"
            >
              <KnowledgeMap />
            </motion.div>
          )}

          {activeView === "study" && (
            <motion.div
              key="study"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full w-full overflow-hidden transform-gpu"
            >
              <StudyMode />
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
      </main>

      <CinematicLayer />
      <PrivacyTransitionHUD />
      <ThemeTransitionOverlay />

      {/* Inspector Slide-over Drawer */}
      <Inspector
        isOpen={inspectorOpen}
        onClose={closeInspector}
        content={inspectorContent}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={navigateTo}
      />

      {/* Toast Notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--color-indigo)",
            color: "var(--color-parchment)",
            border: "1px solid rgba(225, 6, 0, 0.35)",
            fontFamily: "var(--font-ui)",
            fontSize: "13px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            borderRadius: "12px",
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <UIProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </UIProvider>
    </ThemeProvider>
  );
}

export default App;
