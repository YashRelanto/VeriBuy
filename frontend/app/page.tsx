"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, LayoutDashboard, Zap, Search, ShoppingBag, User } from "lucide-react";
import ChatInterface from "./components/ChatInterface";
import Dashboard from "./components/Dashboard";

type View = "chat" | "dashboard";

export default function Home() {
  const [activeView, setActiveView] = useState<View>("chat");
  const [researchData, setResearchData] = useState<any>(null);

  const handleResearchComplete = (data: any) => {
    setResearchData(data);
    setTimeout(() => setActiveView("dashboard"), 500);
  };

  useEffect(() => {
    fetch("http://127.0.0.1:8000/health").catch(() => {});
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: "var(--bg-app)", color: "var(--text-primary)" }}>
      
      {/* ── Navbar ─────────────────────────────────── */}
      <header className="navbar shrink-0 z-50" style={{ height: "60px" }}>
        <div className="h-full w-full max-w-screen-2xl mx-auto px-5 sm:px-8 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)" }}
            >
              <Zap className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Veri<span style={{ color: "var(--primary)" }}>Buy</span>
            </span>
          </div>

          {/* Center Nav */}
          <nav className="hidden md:block">
            <div className="tab-bar">
              <button
                onClick={() => setActiveView("chat")}
                className={`tab-item ${activeView === "chat" ? "active" : ""}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat
              </button>
              <button className="tab-item">
                <Search className="w-3.5 h-3.5" />
                Search
              </button>
              <button className="tab-item">
                <ShoppingBag className="w-3.5 h-3.5" />
                Orders
              </button>
              <button className="tab-item">
                <User className="w-3.5 h-3.5" />
                Profile
              </button>
            </div>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveView("dashboard")}
              className="btn btn-ghost"
              style={
                activeView === "dashboard"
                  ? { background: "var(--primary-subtle)", color: "var(--primary)", border: "1px solid rgba(109,40,217,0.2)" }
                  : { border: "1px solid var(--border)" }
              }
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
              {researchData && activeView !== "dashboard" && (
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: "var(--success)" }}
                />
              )}
            </button>

            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
              style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)" }}
            >
              N
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Chat */}
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${
            activeView === "chat" ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <ChatInterface onResearchComplete={handleResearchComplete} />
        </div>

        {/* Dashboard */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            activeView === "dashboard" ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          {activeView === "dashboard" && <Dashboard data={researchData} />}
        </div>
      </div>
    </div>
  );
}
