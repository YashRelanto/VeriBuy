"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, Bot, User, Headphones, Monitor, Laptop, Coffee, CheckCircle2, Zap, Mic, MicOff } from "lucide-react";

interface AgentStatus {
  name: string;
  label: string;
  status: "idle" | "running" | "complete" | "error";
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const AGENT_LIST: AgentStatus[] = [
  { name: "intent", label: "Understanding Request", status: "idle" },
  { name: "market", label: "Searching Market", status: "idle" },
  { name: "reddit", label: "Scanning Reddit", status: "idle" },
  { name: "youtube", label: "Analyzing YouTube", status: "idle" },
];

const SUGGESTIONS = [
  { text: "Best noise-cancelling headphones under ₹15,000", icon: Headphones, desc: "Audio & Sound" },
  { text: "Ergonomic chair for long work-from-home sessions", icon: Monitor, desc: "Home Office" },
  { text: "Coding laptop with 32GB RAM under ₹1,00,000", icon: Laptop, desc: "Computing" },
  { text: "Espresso machine for beginners under ₹20,000", icon: Coffee, desc: "Kitchen" },
];

const renderMarkdown = (content: string) => {
  if (!content) return null;
  const lines = content.split("\n");
  
  const parseInline = (text: string) => {
    const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(<strong key={match.index} className="font-extrabold text-white">{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(<em key={match.index} className="italic text-gray-200">{token.slice(1, -1)}</em>);
      }
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return lines.map((line, idx) => {
    if (line.startsWith("## ")) {
      return (
        <h3 key={idx} className="text-base font-bold my-2 text-white border-b border-gray-800 pb-1">
          {parseInline(line.slice(3))}
        </h3>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h2 key={idx} className="text-lg font-bold my-2 text-white border-b border-gray-800 pb-1">
          {parseInline(line.slice(2))}
        </h2>
      );
    }
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <li key={idx} className="ml-4 list-disc text-gray-300 my-1">
          {parseInline(line.slice(2))}
        </li>
      );
    }
    return (
      <p key={idx} className="my-1.5 min-h-[1.2em]">
        {parseInline(line)}
      </p>
    );
  });
};

export default function ChatInterface({
  onResearchComplete,
  initialQuery,
  messages,
  setMessages,
  conversationId,
  setConversationId,
}: {
  onResearchComplete: (data: any) => void;
  initialQuery?: string;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
}) {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agents, setAgents] = useState<AgentStatus[]>([...AGENT_LIST]);
  const [streamingText, setStreamingText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [sttSupported, setSttSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const submittedQueryRef = useRef<string>("");

  useEffect(() => {
    if (initialQuery && messages.length === 0 && submittedQueryRef.current !== initialQuery) {
      submittedQueryRef.current = initialQuery;
      handleSubmit(initialQuery);
    }
  }, [initialQuery]);

  // Init Web Speech API
  useEffect(() => {
    // @ts-ignore
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSttSupported(true);
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-IN";
      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + " ";
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) setInput((prev) => (prev + " " + final).trim());
        setInterimText(interim);
      };
      rec.onend = () => {
        setIsListening(false);
        setInterimText("");
      };
      rec.onerror = () => {
        setIsListening(false);
        setInterimText("");
      };
      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInterimText("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const resetAgents = () => setAgents(AGENT_LIST.map((a) => ({ ...a, status: "idle" as const })));

  const handleSubmit = async (text?: string) => {
    const message = text || input.trim();
    if (!message || isProcessing) return;

    // Stop recording if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimText("");
    }

    setInput("");
    setIsProcessing(true);
    resetAgents();
    setStreamingText("");

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
        body: JSON.stringify({ message, conversation_id: conversationId }),
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
            if (line.startsWith("event:")) {
              currentEventType = line.slice(6).trim();
              continue;
            }
            if (line.startsWith("data:")) {
              const raw = line.slice(5).trim();
              if (!raw) continue;
              try {
                const data = JSON.parse(raw);
                if (currentEventType === "conversation_id" && data.conversation_id) {
                  setConversationId(data.conversation_id);
                  continue;
                }
                handleSSEEvent(data, (t) => {
                  fullTokenText += t;
                  setStreamingText(fullTokenText);
                });
              } catch { /* skip malformed */ }
            }
          }
        }
      }

      if (fullTokenText) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: fullTokenText, timestamp: new Date() },
        ]);
        setStreamingText("");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⚠️ Unable to connect to the backend. Please ensure the FastAPI server is running on port 8000.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const buildFollowupMessage = (evData: any, message: string) => {
    const requiredFields = evData?.required_fields || [];
    const optionalFields = evData?.optional_fields || [];
    
    if (requiredFields.length === 0 && optionalFields.length === 0) {
      return message || "Could you tell me a bit more?";
    }
    
    let conversationalMsg = "To help you find the best options, could you let me know:\n\n";
    
    if (requiredFields.length > 0) {
      requiredFields.forEach((field: any) => {
        conversationalMsg += `- ${field.question}\n`;
      });
    }
    
    if (optionalFields.length > 0) {
      conversationalMsg += "\nAlso, if you have preferences for these, feel free to share:\n";
      optionalFields.forEach((field: any) => {
        conversationalMsg += `- ${field.question}\n`;
      });
    }
    
    return conversationalMsg;
  };

  const handleSSEEvent = (data: any, onToken: (text: string) => void) => {
    const { event_type, agent, message, data: evData } = data;
    switch (event_type) {
      case "agent_start":
        setAgents((p) => p.map((a) => a.name === agent ? { ...a, status: "running", message } : a));
        break;
      case "agent_complete":
        setAgents((p) => p.map((a) => a.name === agent ? { ...a, status: "complete", message } : a));
        break;
      case "agent_progress":
        setAgents((p) => p.map((a) => a.name === agent ? { ...a, message } : a));
        break;
      case "token":
        if (evData?.content) onToken(evData.content);
        break;
      case "final_result":
        if (evData) onResearchComplete(evData);
        break;
      case "followup_needed":
        const followupContent = buildFollowupMessage(evData, message);
        setMessages((p) => [
          ...p,
          { id: crypto.randomUUID(), role: "assistant", content: followupContent, timestamp: new Date() },
        ]);
        break;
      case "error":
        setAgents((p) => p.map((a) => a.name === agent ? { ...a, status: "error", message } : a));
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
  const activeAgent = agents.find((a) => a.status === "running");
  const agentMessage = activeAgent?.message || "Analyzing your request...";

  return (
    <div className="flex flex-col w-full h-full">
      {/* Messages / Welcome */}
      <div
        ref={messagesAreaRef}
        className="flex-1 overflow-y-auto w-full flex flex-col items-center"
        style={{ padding: hasStarted ? "24px 0" : "0" }}
      >
        {!hasStarted ? (
          /* ── Welcome ── */
          <div className="h-full w-full flex flex-col items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-2xl mx-auto flex flex-col items-center text-center"
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)", boxShadow: "0 8px 32px var(--primary-glow)" }}
              >
                <Zap className="w-7 h-7 text-white" fill="white" />
              </div>

              {/* Headline */}
              <h2
                className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight"
                style={{ letterSpacing: "-0.02em" }}
              >
                <span style={{ color: "var(--text-primary)" }}>What should we</span>{" "}
                <span className="gradient-text">verify</span>{" "}
                <span style={{ color: "var(--text-primary)" }}>before you buy?</span>
              </h2>

              <p className="text-base mb-10 leading-relaxed max-w-lg" style={{ color: "var(--text-secondary)" }}>
                Describe what you&apos;re looking for. VeriBuy checks market prices, community reviews, and expert videos before recommending.
              </p>

              {/* Suggestion Cards */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-8">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.07 }}
                    onClick={() => handleSubmit(s.text)}
                    className="card card-hover group flex items-start gap-3 p-4 text-left w-full"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "var(--primary-subtle)" }}
                    >
                      <s.icon className="w-4 h-4" style={{ color: "var(--primary)" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-snug mb-0.5" style={{ color: "var(--text-primary)" }}>
                        {s.text}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{s.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Badge */}
              <span className="badge" style={{ background: "var(--primary-subtle)", color: "var(--primary)", border: "1px solid rgba(109,40,217,0.15)" }}>
                <Sparkles className="w-3 h-3" />
                Evidence-backed AI research
              </span>
            </motion.div>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="w-full max-w-2xl px-6 flex flex-col gap-5">
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i === messages.length - 1 ? 0.05 : 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role !== "user" && (
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "var(--primary-subtle)", border: "1px solid rgba(109,40,217,0.15)" }}
                  >
                    <Bot className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  </div>
                )}

                <div
                  className="msg-bubble px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          background: "linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)",
                          color: "#fff",
                          borderRadius: "18px 4px 18px 18px",
                          boxShadow: "0 2px 12px var(--primary-glow)",
                        }
                      : {
                          background: "var(--card-bg)",
                          border: "1px solid var(--card-border)",
                          color: "var(--text-secondary)",
                          borderRadius: "4px 18px 18px 18px",
                          boxShadow: "var(--card-shadow)",
                        }
                  }
                >
                  <div className="whitespace-pre-wrap">{renderMarkdown(msg.content)}</div>
                  <div
                    className="text-[10px] mt-1.5"
                    style={{ color: msg.role === "user" ? "rgba(255,255,255,0.6)" : "var(--text-tertiary)", textAlign: msg.role === "user" ? "right" : "left" }}
                  >
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                {msg.role === "user" && (
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
                  >
                    <User className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
                  </div>
                )}
              </motion.div>
            ))}

            {/* Streaming bubble */}
            {streamingText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 justify-start">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "var(--primary-subtle)", border: "1px solid rgba(109,40,217,0.15)" }}
                >
                  <Bot className="w-4 h-4" style={{ color: "var(--primary)" }} />
                </div>
                <div
                  className="msg-bubble px-4 py-3 text-[13.5px] leading-relaxed"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", color: "var(--text-secondary)", borderRadius: "4px 18px 18px 18px", boxShadow: "var(--card-shadow)" }}
                >
                  <span className="whitespace-pre-wrap">{renderMarkdown(streamingText)}</span>
                  <span
                    className="inline-block w-[3px] h-4 ml-0.5 animate-pulse align-middle"
                    style={{ background: "var(--primary)", borderRadius: "2px" }}
                  />
                </div>
              </motion.div>
            )}

            {/* Typing indicator */}
            {isProcessing && !streamingText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 justify-start">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--primary-subtle)", border: "1px solid rgba(109,40,217,0.15)" }}
                >
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
                </div>
                <div
                  className="px-4 py-3 text-[13.5px]"
                  style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "4px 18px 18px 18px", boxShadow: "var(--card-shadow)" }}
                >
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input Bar ─────────────────────────────── */}
      <div
        className="shrink-0 w-full flex justify-center"
        style={{
          borderTop: hasStarted ? "1px solid var(--border)" : "none",
          background: hasStarted ? "var(--bg-nav)" : "transparent",
          backdropFilter: hasStarted ? "blur(20px)" : "none",
          padding: hasStarted ? "14px 16px 16px" : "0 16px 32px",
        }}
      >
        <div className="w-full max-w-2xl">
          <div
            className="flex items-end gap-2 p-2 rounded-2xl transition-all"
            style={{
              background: "var(--surface-0)",
              border: isListening ? "1.5px solid rgba(239,68,68,0.5)" : "1.5px solid var(--border-md)",
              boxShadow: isListening ? "0 0 0 3px rgba(239,68,68,0.08)" : "var(--card-shadow)",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          >
            {/* Mic Button */}
            {sttSupported && (
              <button
                onClick={toggleListening}
                disabled={isProcessing}
                title={isListening ? "Stop recording" : "Speak your query"}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all relative"
                style={
                  isListening
                    ? { background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }
                    : { background: "var(--surface-2)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }
                }
              >
                {isListening && (
                  <span className="absolute inset-0 rounded-xl animate-ping" style={{ background: "rgba(239,68,68,0.15)" }} />
                )}
                {isListening ? <MicOff className="w-4 h-4 relative z-10" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            <div className="flex-1 flex flex-col min-w-0">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening… speak now" : "Describe what you're looking for…"}
                rows={1}
                disabled={isProcessing}
                className="flex-1 bg-transparent outline-none resize-none text-[13.5px] leading-relaxed py-2.5 px-2"
                style={{
                  minHeight: "44px",
                  maxHeight: "130px",
                  color: "var(--text-primary)",
                  border: "none",
                }}
              />
              {/* Interim transcription preview */}
              {interimText && (
                <p className="px-2 pb-1 text-[12px] italic" style={{ color: "var(--text-tertiary)" }}>
                  {interimText}
                  <span className="inline-block w-1 h-3 ml-0.5 align-middle animate-pulse rounded-sm" style={{ background: "#ef4444" }} />
                </p>
              )}
            </div>
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isProcessing}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
              style={
                input.trim() && !isProcessing
                  ? { background: "var(--primary)", color: "#fff", boxShadow: "0 2px 10px var(--primary-glow)" }
                  : { background: "var(--surface-2)", color: "var(--text-tertiary)" }
              }
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* Pipeline Status */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-3 flex flex-col items-center gap-2"
              >
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {agents.map((agent, i) => (
                    <div key={agent.name} className="flex items-center gap-2">
                      <div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                        style={
                          agent.status === "complete"
                            ? { background: "rgba(5,150,105,0.08)", color: "var(--success)", border: "1px solid rgba(5,150,105,0.2)" }
                            : agent.status === "running"
                            ? { background: "var(--primary-subtle)", color: "var(--primary)", border: "1px solid rgba(109,40,217,0.25)", boxShadow: "0 0 12px var(--primary-glow)" }
                            : { background: "var(--surface-1)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }
                        }
                      >
                        {agent.status === "complete" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {agent.status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {agent.status === "idle" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--text-tertiary)" }} />}
                        {agent.label}
                      </div>
                      {i < agents.length - 1 && (
                        <div
                          className="w-5 h-px"
                          style={{ background: agents[i].status === "complete" ? "var(--primary)" : "var(--border)" }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] italic" style={{ color: "var(--text-tertiary)" }}>{agentMessage}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
