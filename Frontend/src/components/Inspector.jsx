import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Inspector({ isOpen, onClose, content }) {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop on mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-40 lg:hidden"
          />

          <motion.aside
            initial={
              prefersReducedMotion ? { opacity: 0 } : { x: "100%", opacity: 0 }
            }
            animate={
              prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }
            }
            exit={
              prefersReducedMotion ? { opacity: 0 } : { x: "100%", opacity: 0 }
            }
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed lg:static top-0 right-0 h-full w-full max-w-sm bg-indigo border-l border-fog/20 z-50 flex flex-col shrink-0"
          >
            <header className="p-6 border-b border-fog/10 flex justify-between items-center bg-indigo/50 backdrop-blur-md">
              <h2 className="font-ui-label text-parchment uppercase tracking-widest text-xs">
                Inspector
              </h2>
              <button
                onClick={onClose}
                className="text-fog hover:text-parchment transition-colors"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 font-body text-parchment markdown-body leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || "Select a citation or chunk to inspect it here."}
              </ReactMarkdown>
            </div>

            <div className="p-6 border-t border-fog/10 bg-ink/30">
              <button className="btn-signal w-full py-3 rounded-xl font-ui-label text-white text-xs uppercase tracking-wider font-semibold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all">
                Open in PDF Viewer
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
