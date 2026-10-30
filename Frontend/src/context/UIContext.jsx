import { createContext, useContext, useState, useEffect, useRef } from "react";
import { API_BASE } from "../config";
import { audioHaptics } from "../utils/audioHaptics";

const UIContext = createContext();

export function UIProvider({ children }) {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorContent, setInspectorContent] = useState("");
  const [privacyMode, setPrivacyModeState] = useState("normal");
  const [isModeLoading, setIsModeLoading] = useState(false);
  const [modeTransition, setModeTransition] = useState(null);
  const transitionTimerRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);

  const fetchDocuments = async (targetMode = null) => {
    const mode = targetMode || privacyMode;
    setIsDocsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/documents?mode=${mode}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.warn("Failed to load documents:", err);
    } finally {
      setIsDocsLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${API_BASE}/mode`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.mode) {
          setPrivacyModeState(data.mode);
          fetchDocuments(data.mode);
        } else {
          fetchDocuments("normal");
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch privacy mode:", err);
        fetchDocuments("normal");
      });

    const handleDocUpdate = () => fetchDocuments();
    window.addEventListener("documentUpdated", handleDocUpdate);
    return () => window.removeEventListener("documentUpdated", handleDocUpdate);
  }, []);

  const dismissModeTransition = () => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    setModeTransition(null);
  };

  const setPrivacyMode = async (mode) => {
    if (mode === privacyMode && !isModeLoading) return;
    const prevMode = privacyMode;
    setIsModeLoading(true);

    // Trigger instant visual + audio transition
    setModeTransition({
      active: true,
      toMode: mode,
      fromMode: prevMode,
      id: Date.now(),
    });

    if (mode === "private") {
      audioHaptics.playPrivateEngaged();
    } else {
      audioHaptics.playNormalEngaged();
    }

    // Auto-dismiss HUD after 1.8 seconds
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = setTimeout(() => {
      setModeTransition(null);
      transitionTimerRef.current = null;
    }, 2400);

    // Eagerly refresh documents for target mode
    fetchDocuments(mode);

    try {
      const res = await fetch(`${API_BASE}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) {
        const data = await res.json();
        setPrivacyModeState(data.mode);
        return data;
      } else {
        setPrivacyModeState(mode);
      }
    } catch (err) {
      console.error("Failed to update privacy mode:", err);
      // Still set mode client-side for immediate responsive experience
      setPrivacyModeState(mode);
    } finally {
      setIsModeLoading(false);
    }
  };

  const openInspector = (content) => {
    setInspectorContent(content);
    setInspectorOpen(true);
  };

  const closeInspector = () => {
    setInspectorOpen(false);
  };

  return (
    <UIContext.Provider
      value={{
        inspectorOpen,
        inspectorContent,
        openInspector,
        closeInspector,
        privacyMode,
        setPrivacyMode,
        isModeLoading,
        modeTransition,
        dismissModeTransition,
        documents,
        isDocsLoading,
        refreshDocuments: fetchDocuments,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
