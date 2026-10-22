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

  return (
    <ThemeContext.Provider
      value={{ themeMode, setThemeMode, accent, setAccent }}
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
