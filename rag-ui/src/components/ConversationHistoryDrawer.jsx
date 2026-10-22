import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Sparkles,
  Clock,
  ChevronRight,
  Database,
  Calendar,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

function formatRelativeTime(dateString) {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ConversationHistoryDrawer({
  isOpen,
  onClose,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onUpdateTitle,
  onClearAll,
  onOpenSummary,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      const matchTitle = s.title?.toLowerCase().includes(q);
      const matchDoc = s.document?.toLowerCase().includes(q);
      const matchMessages = s.messages?.some((m) =>
        m.content?.toLowerCase().includes(q)
      );
      return matchTitle || matchDoc || matchMessages;
    });
  }, [sessions, searchQuery]);

  const handleStartEditing = (session, e) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveTitle = (id, e) => {
    e?.stopPropagation();
    if (editingTitle.trim()) {
      onUpdateTitle(id, editingTitle.trim());
      toast.success("Conversation renamed");
    }
    setEditingId(null);
  };

  const handleKeyDown = (id, e) => {
    if (e.key === "Enter") {
      handleSaveTitle(id, e);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-ink/75 backdrop-blur-sm transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="w-screen max-w-md bg-[#252525] border-l border-fog/15 shadow-2xl flex flex-col pointer-events-auto text-parchment"
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-fog/15 bg-indigo/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brass/15 border border-brass/35 flex items-center justify-center text-brass">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-hero text-base font-semibold text-parchment leading-tight">
                      Past Conversations
                    </h2>
                    <span className="text-[10px] font-data-mono px-2 py-0.5 rounded-full bg-brass/15 text-brass border border-brass/30">
                      {sessions.length}
                    </span>
                  </div>
                  <p className="font-ui-label text-[11px] text-fog">
                    Persisted locally &middot; Multi-session memory
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-ink/50 hover:bg-ink border border-fog/20 flex items-center justify-center text-fog hover:text-parchment transition-colors cursor-pointer"
                title="Close History Drawer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Action Toolbar */}
            <div className="p-4 border-b border-fog/10 bg-ink/30 space-y-2.5 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                {/* New Chat Button */}
                <button
                  onClick={() => {
                    onNewChat();
                    onClose();
                  }}
                  className="h-9 px-3 rounded-xl bg-ink/70 hover:bg-ink border border-fog/20 hover:border-brass/40 text-xs font-ui-label font-semibold flex items-center justify-center gap-1.5 transition-all text-parchment cursor-pointer shadow-sm active:scale-95"
                >
                  <Plus size={15} className="text-brass" />
                  <span>New Chat</span>
                </button>

                {/* Summarize All Conversations Button */}
                <button
                  onClick={() => {
                    onOpenSummary();
                  }}
                  disabled={sessions.length === 0}
                  className="h-9 px-3 rounded-xl bg-brass hover:bg-[#ff1a14] text-white text-xs font-ui-label font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-brass/25 cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                  title="Synthesize and summarize all stored conversations"
                >
                  <Sparkles size={14} />
                  <span>Summarize All</span>
                </button>
              </div>

              {/* Search Field */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-fog pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter past conversations..."
                  className="w-full bg-ink/80 text-parchment border border-fog/20 rounded-xl pl-9 pr-8 py-1.5 text-xs font-body placeholder:text-fog/60 focus:outline-none focus:border-brass transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fog hover:text-parchment"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredSessions.length === 0 ? (
                <div className="py-12 text-center text-fog flex flex-col items-center">
                  <MessageSquare size={32} className="text-fog/30 mb-2" />
                  <p className="text-xs font-ui-label">
                    {searchQuery ? "No matching conversations found." : "No saved conversations yet."}
                  </p>
                  <button
                    onClick={() => {
                      onNewChat();
                      onClose();
                    }}
                    className="mt-3 text-xs text-brass underline font-ui-label cursor-pointer"
                  >
                    Start a conversation
                  </button>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const isEditing = editingId === session.id;
                  const userCount = session.messages?.filter((m) => m.role === "user").length || 0;

                  return (
                    <motion.div
                      key={session.id}
                      layout
                      whileHover={{ scale: 1.012, x: 2 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => {
                        if (!isEditing) {
                          onSelectSession(session.id);
                          onClose();
                        }
                      }}
                      className={`relative p-3 rounded-xl border transition-colors cursor-pointer group flex flex-col gap-1.5 ${
                        isActive
                          ? "bg-indigo/60 border-brass shadow-md shadow-brass/10"
                          : "bg-ink/40 border-fog/15 hover:border-fog/35 hover:bg-ink/70"
                      }`}
                    >
                      {/* Active Indicator Strip */}
                      {isActive && (
                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-brass rounded-r-full" />
                      )}

                      <div className="flex items-start justify-between gap-2 pl-1.5">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(session.id, e)}
                                autoFocus
                                className="bg-ink border border-brass text-parchment rounded px-2 py-0.5 text-xs font-ui w-full focus:outline-none"
                              />
                              <button
                                onClick={(e) => handleSaveTitle(session.id, e)}
                                className="p-1 rounded bg-brass text-white text-xs hover:bg-[#ff1a14]"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <h3
                                className={`text-xs font-ui font-semibold truncate ${
                                  isActive ? "text-brass" : "text-parchment group-hover:text-brass"
                                } transition-colors`}
                                title={session.title}
                              >
                                {session.title}
                              </h3>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-1 text-[11px] font-data-mono text-fog">
                            <span>{formatRelativeTime(session.updatedAt || session.createdAt)}</span>
                            <span>&middot;</span>
                            <span>{userCount} query{userCount === 1 ? "" : "s"}</span>
                            {session.document && session.document !== "ALL" && (
                              <>
                                <span>&middot;</span>
                                <span className="text-brass truncate max-w-[110px]" title={session.document}>
                                  {session.document}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Card Action Icons */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleStartEditing(session, e)}
                              className="p-1 rounded hover:bg-ink text-fog hover:text-parchment transition-colors"
                              title="Rename Conversation"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSession(session.id);
                              }}
                              className="p-1 rounded hover:bg-brass/20 text-fog hover:text-brass transition-colors"
                              title="Delete Conversation"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-fog/15 bg-indigo/30 flex items-center justify-between shrink-0 text-xs font-ui-label text-fog">
              <span>Saved in local browser memory</span>
              {sessions.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete all conversation history?")) {
                      onClearAll();
                      toast.success("Conversation history cleared");
                    }
                  }}
                  className="text-brass hover:text-white hover:underline transition-colors cursor-pointer"
                >
                  Clear All History
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      </div>
    </AnimatePresence>
  );
}
