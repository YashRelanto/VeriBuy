"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, Bot, User, Mic, Image as ImageIcon, Headphones, Monitor, Laptop, Coffee, CheckCircle2 } from "lucide-react";

interface AgentStatus {
  name: string;
  label: string;
  status: "idle" | "running" | "complete" | "error";
  message?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  agentData?: any;
}

const AGENT_LIST: AgentStatus[] = [
  { name: "intent", label: "Intent Analysis", status: "idle" },
  { name: "market", label: "Market Search", status: "idle" },
];

const SUGGESTIONS = [
  { text: "Noise-cancelling headphones under ₹15,000", icon: Headphones },
  { text: "Ergonomic chairs for long remote work", icon: Monitor }, // using monitor as a proxy for desk setup
  { text: "Best coding laptops with 32GB RAM", icon: Laptop },
  { text: "Espresso machines for beginners", icon: Coffee },
];

export default function ChatInterface({
  onResearchComplete,
}: {
  onResearchComplete: (data: any) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agents, setAgents] = useState<AgentStatus[]>([...AGENT_LIST]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const resetAgents = () => {
    setAgents(AGENT_LIST.map((a) => ({ ...a, status: "idle" as const })));
  };

  const handleSubmit = async (text?: string) => {
    const message = text || input.trim();
    if (!message || isProcessing) return;

    setInput("");
    setIsProcessing(true);
    resetAgents();
    setStreamingText("");

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiUrl}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) throw new Error("Failed to connect to backend");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let fullTokenText = "";
      let currentEventType = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          accumulated += decoder.decode(value, { stream: true });
          const lines = accumulated.split("\n");
          accumulated = lines.pop() || "";

          for (const line of lines) {
            // Track the event type from "event:" lines
            if (line.startsWith("event:")) {
              currentEventType = line.slice(6).trim();
              continue;
            }

            if (line.startsWith("data:")) {
              const raw = line.slice(5).trim();
              if (!raw) continue;

              try {
                const data = JSON.parse(raw);

                // Handle conversation_id event
                if (currentEventType === "conversation_id" && data.conversation_id) {
                  setConversationId(data.conversation_id);
                  continue;
                }

                // Handle all agent events
                handleSSEEvent(data, (text) => {
                  fullTokenText += text;
                  setStreamingText(fullTokenText);
                });
              } catch {
                // Skip malformed events
              }
            }
          }
        }
      }

      // Add assistant message from accumulated tokens
      if (fullTokenText) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullTokenText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingText("");
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "⚠️ Unable to connect to the backend. Please ensure the FastAPI server is running on port 8000.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSSEEvent = (data: any, onToken: (text: string) => void) => {
    const eventType = data.event_type;
    const agentName = data.agent;
    const message = data.message;

    switch (eventType) {
      case "agent_start":
        setAgents((prev) =>
          prev.map((a) =>
            a.name === agentName
              ? { ...a, status: "running" as const, message }
              : a
          )
        );
        break;

      case "agent_complete":
        setAgents((prev) =>
          prev.map((a) =>
            a.name === agentName
              ? { ...a, status: "complete" as const, message }
              : a
          )
        );
        break;

      case "agent_progress":
        setAgents((prev) =>
          prev.map((a) =>
            a.name === agentName ? { ...a, message } : a
          )
        );
        break;

      case "token":
        if (data.data?.content) {
          onToken(data.data.content);
        }
        break;

      case "final_result":
        if (data.data) {
          onResearchComplete(data.data);
        }
        break;

      case "followup_needed":
        const followupMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: message || "I need a bit more information to help you better.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, followupMsg]);
        break;

      case "error":
        setAgents((prev) =>
          prev.map((a) =>
            a.name === agentName
              ? { ...a, status: "error" as const, message }
              : a
          )
        );
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasStarted = messages.length > 0;

  return (
    <div className="flex flex-col w-full h-full bg-transparent items-center">
      {/* Messages Area */}
      <div className="flex-1 w-full max-w-6xl overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col items-center">
        {!hasStarted ? (
          // Welcome Screen / Hero Landing
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl text-center px-2 sm:px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full flex flex-col items-center text-center"
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[var(--text-tertiary)]">
                <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" />
                Evidence-backed shopping intelligence
              </div>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-5 text-[var(--text-primary)] leading-[1.05] tracking-tight text-center text-balance">
                What should we verify before you buy?
              </h2>
              <p className="text-[var(--text-secondary)] mb-10 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-center">
                Ask about a product, budget, use case, or comparison. VeriBuy checks market signals, creator reviews, and community evidence before recommending.
              </p>

              {/* Suggestion Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-3xl mx-auto mb-12">
                {SUGGESTIONS.map((suggestion, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    onClick={() => handleSubmit(suggestion.text)}
                    className="premium-card premium-card-hover p-4 text-left flex items-start gap-3 cursor-pointer overflow-hidden min-h-[86px]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary-subtle)] flex items-center justify-center shrink-0">
                      <suggestion.icon className="w-4 h-4 text-[var(--primary)]" />
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-secondary)] leading-snug line-clamp-2">
                      {suggestion.text}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          // Chat Messages
          <div className="w-full max-w-4xl flex flex-col gap-5 pb-4">
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i === messages.length - 1 ? 0.1 : 0 }}
                className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                {msg.role !== "user" && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--primary-subtle)] flex items-center justify-center shrink-0 mt-1 border border-[var(--border)]">
                    <Bot className="w-4 h-4 text-[var(--primary)]" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] sm:max-w-[78%] w-fit px-4 py-3 text-sm leading-relaxed shadow-sm flex-shrink-0 overflow-hidden ${msg.role === "user"
                      ? "bg-gradient-to-br from-violet-500 to-indigo-500 text-white rounded-2xl rounded-tr-md shadow-[var(--shadow-glow)]"
                      : "premium-card rounded-2xl rounded-tl-md prose-ai"
                    }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <div
                    className={`text-[10px] mt-1.5 font-medium ${msg.role === "user"
                        ? "text-white/70 text-right"
                        : "text-[var(--text-tertiary)]"
                      }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {msg.role === "user" && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 mt-1 shadow-sm border border-[var(--border)]">
                    <User className="w-4 h-4 text-[var(--primary)]" />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Streaming text */}
            {streamingText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--primary-subtle)] flex items-center justify-center shrink-0 mt-1 border border-[var(--border)]">
                  <Bot className="w-4 h-4 text-[var(--primary)]" />
                </div>
                <div className="premium-card max-w-[88%] sm:max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-md text-sm leading-relaxed whitespace-pre-wrap prose-ai">
                  {streamingText}
                  <span className="inline-block w-1.5 h-4 bg-[var(--primary)] ml-0.5 animate-pulse" />
                </div>
              </motion.div>
            )}

            {/* Typing indicator */}
            {isProcessing && !streamingText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--primary-subtle)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                  <Loader2 className="w-4 h-4 text-[var(--primary)] animate-spin" />
                </div>
                <div className="premium-card px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={`px-3 sm:px-4 py-3 transition-all duration-500 ease-in-out w-full flex justify-center ${!hasStarted ? 'mt-auto mb-5 md:mb-9' : 'border-t border-[var(--border)] bg-[var(--bg-glass)] backdrop-blur-xl pb-4 sm:pb-5'}`}>
        <div className="w-full max-w-4xl relative">
          <div className="premium-card flex items-end gap-2 p-2.5 sm:p-3 rounded-2xl focus-within:border-[var(--border-hover)] focus-within:shadow-[var(--shadow-glow)] transition-all duration-200">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you're looking for..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none py-2.5 px-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] leading-relaxed min-w-0"
              style={{ minHeight: "42px", maxHeight: "120px" }}
              disabled={isProcessing}
            />

            {/* Action Icons */}
            <div className="hidden sm:flex items-center gap-0.5 text-[var(--text-tertiary)]">
              <button className="p-2 hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-white/[0.06]">
                <Mic className="w-4 h-4" />
              </button>
              <button className="p-2 hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-white/[0.06]">
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isProcessing}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${input.trim() && !isProcessing
                  ? "bg-[var(--primary)] text-white shadow-[var(--shadow-glow)] hover:bg-[var(--primary-hover)] hover:-translate-y-0.5"
                  : "bg-white/[0.06] text-[var(--text-tertiary)]"
                }`}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Horizontal Pipeline Stepper (Mockup Style) */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-6 flex flex-col items-center justify-center z-50"
              >
                <div className="premium-card flex items-center gap-2 md:gap-3 flex-wrap justify-center max-w-full px-3 py-3 rounded-2xl">
                  {agents.map((agent, i) => (
                    <div key={agent.name} className="flex items-center">
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shadow-sm border ${agent.status === "complete"
                            ? "bg-[var(--primary-subtle)] text-[var(--text-accent)] border-[var(--border-hover)]"
                            : agent.status === "running"
                              ? "bg-white/[0.08] text-[var(--text-primary)] border-[var(--border-hover)] shadow-[var(--shadow-glow)] animate-pulse"
                              : "bg-white/[0.04] text-[var(--text-tertiary)] border-[var(--border)]"
                          }`}
                      >
                        {agent.status === "complete" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {agent.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {agent.status === "idle" && <div className="w-1.5 h-1.5 rounded-full bg-[var(--border-hover)]" />}
                        {agent.label}
                      </div>

                      {/* Connecting Line */}
                      {i < agents.length - 1 && (
                        <div className={`w-4 md:w-6 h-px mx-1 md:mx-2 ${agents[i].status === "complete" ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                          }`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs font-medium text-[var(--text-tertiary)] max-w-lg text-center truncate italic">
                  {agents.find(a => a.status === "running")?.message || "Analyzing request..."}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
