import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem("themeMode") || "dark";
  });

  const [accent, setAccent] = useState(() => {
    const storedAccent = localStorage.getItem("themeAccent");
    return ["red", "silver"].includes(storedAccent) ? storedAccent : "red";
  });

  const [themeTransition, setThemeTransition] = useState(null);

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem("themeAccent", accent);
    // Apply the selected accent as a CSS variable on the root
    document.documentElement.style.setProperty(
      "--theme-accent",
      `var(--accent-${accent})`,
    );
  }, [accent]);

  const triggerThemeTransition = (targetMode, e) => {
    let origin = null;
    if (e && e.clientX && e.clientY) {
      origin = { x: e.clientX, y: e.clientY };
    }
    setThemeMode(targetMode);
    setThemeTransition({
      id: Date.now(),
      mode: targetMode,
      origin: origin || { x: typeof window !== "undefined" ? window.innerWidth - 80 : 300, y: 40 },
    });
  };

  const toggleTheme = (e) => {
    const nextMode = themeMode === "light" ? "dark" : "light";
    triggerThemeTransition(nextMode, e);
  };

  const dismissThemeTransition = () => {
    setThemeTransition(null);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        accent,
        setAccent,
        toggleTheme,
        triggerThemeTransition,
        themeTransition,
        dismissThemeTransition,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
