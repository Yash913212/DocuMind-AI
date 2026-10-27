import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Sparkles } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export function ThemeTransitionOverlay() {
  const { themeTransition, dismissThemeTransition } = useTheme();
  const [windowDimensions, setWindowDimensions] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-dismiss the transition overlay after 1.8 seconds
  useEffect(() => {
    if (!themeTransition) return;
    const timer = setTimeout(() => {
      dismissThemeTransition();
    }, 1800);
    return () => clearTimeout(timer);
  }, [themeTransition, dismissThemeTransition]);

  const isDark = themeTransition?.mode === "dark";
  const originX = themeTransition?.origin?.x ?? windowDimensions.width - 80;
  const originY = themeTransition?.origin?.y ?? 40;
  const maxRadius = Math.hypot(
    Math.max(originX, windowDimensions.width - originX),
    Math.max(originY, windowDimensions.height - originY)
  );

  return (
    <AnimatePresence>
      {themeTransition && (
        <motion.div
          key={`theme-overlay-${themeTransition.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 pointer-events-none z-[130] overflow-hidden select-none"
          aria-hidden="true"
        >
          {/* 1. Celestial Radial Wave expanding outwards from click origin */}
          <motion.div
            initial={{
              scale: 0,
              opacity: 0.9,
            }}
            animate={{
              scale: 1,
              opacity: [0.95, 0.7, 0],
            }}
            transition={{
              duration: 0.95,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              position: "absolute",
              left: originX,
              top: originY,
              width: maxRadius * 2.5,
              height: maxRadius * 2.5,
              marginLeft: -maxRadius * 1.25,
              marginTop: -maxRadius * 1.25,
              borderRadius: "50%",
              background: isDark
                ? "radial-gradient(circle, rgba(26,26,28,0.92) 0%, rgba(34,34,37,0.7) 40%, rgba(225,6,0,0.18) 70%, transparent 100%)"
                : "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(243,243,246,0.85) 45%, rgba(192,192,192,0.25) 75%, transparent 100%)",
              boxShadow: isDark
                ? "0 0 100px rgba(225,6,0,0.3) inset, 0 0 80px rgba(0,0,0,0.5)"
                : "0 0 100px rgba(255,255,255,0.9) inset, 0 0 60px rgba(225,6,0,0.12)",
            }}
          />

          {/* 2. Expanding Shockwave Ring */}
          <motion.div
            initial={{
              scale: 0.05,
              opacity: 0.9,
            }}
            animate={{
              scale: 1,
              opacity: [0.9, 0.5, 0],
            }}
            transition={{
              duration: 1.05,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              position: "absolute",
              left: originX,
              top: originY,
              width: maxRadius * 2.3,
              height: maxRadius * 2.3,
              marginLeft: -maxRadius * 1.15,
              marginTop: -maxRadius * 1.15,
              borderRadius: "50%",
              border: isDark
                ? "2px solid rgba(225, 6, 0, 0.65)"
                : "2px solid rgba(192, 192, 192, 0.8)",
              boxShadow: isDark
                ? "0 0 25px rgba(225,6,0,0.6), 0 0 50px rgba(225,6,0,0.25)"
                : "0 0 25px rgba(255,255,255,0.9), 0 0 45px rgba(225,6,0,0.2)",
            }}
          />

          {/* 3. Floating Apple Dynamic Island HUD Pill at Top Center */}
          <div className="fixed top-5 inset-x-0 flex justify-center z-[135]">
            <motion.div
              initial={{ y: -50, scale: 0.85, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: -30, scale: 0.9, opacity: 0 }}
              transition={{
                type: "spring",
                damping: 20,
                stiffness: 340,
              }}
              className={`flex items-center gap-3 px-4 py-2 rounded-2xl backdrop-blur-2xl shadow-2xl border ${
                isDark
                  ? "bg-[#1d1d20]/95 text-parchment border-brass/35 shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_20px_rgba(225,6,0,0.2)]"
                  : "bg-white/95 text-[#18181b] border-fog/25 shadow-[0_12px_36px_rgba(0,0,0,0.15),0_0_20px_rgba(255,255,255,0.6)]"
              }`}
            >
              {/* Spinning Celestial Icon Badge */}
              <motion.div
                initial={{ rotate: -180, scale: 0.3 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", damping: 15, stiffness: 300 }}
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                  isDark
                    ? "bg-brass/20 text-brass border border-brass/30 shadow-brass/25"
                    : "bg-amber-100 text-amber-600 border border-amber-300 shadow-amber-200"
                }`}
              >
                {isDark ? <Moon size={15} /> : <Sun size={15} />}
              </motion.div>

              {/* Title & Description */}
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-data-mono uppercase tracking-wider">
                    {isDark ? "Charcoal Noir" : "Moonlit Silver"}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isDark ? "bg-brass animate-pulse" : "bg-amber-500 animate-pulse"
                    }`}
                  />
                </div>
                <span className="text-[10px] font-ui-label text-fog">
                  {isDark ? "Dark Canvas Active" : "Daylight Studio Active"}
                </span>
              </div>

              {/* Micro Badge */}
              <div
                className={`ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-data-mono uppercase tracking-widest border ${
                  isDark
                    ? "bg-white/5 border-white/10 text-fog"
                    : "bg-black/5 border-black/10 text-fog"
                }`}
              >
                <Sparkles size={9} className={isDark ? "text-brass" : "text-amber-500"} />
                <span>THEME</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
