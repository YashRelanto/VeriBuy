"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  LayoutDashboard,
  Zap,
  Search,
  Shield,
  BarChart3,
} from "lucide-react";
import ChatInterface from "./components/ChatInterface";
import Dashboard from "./components/Dashboard";

type View = "chat" | "dashboard";

export default function Home() {
  const [activeView, setActiveView] = useState<View>("chat");
  const [researchData, setResearchData] = useState<any>(null);

  const handleResearchComplete = (data: any) => {
    setResearchData(data);
    // Auto-switch to dashboard when results are ready
    setTimeout(() => setActiveView("dashboard"), 500);
  };

  useEffect(() => {
    fetch("http://127.0.0.1:8000/health").catch(() => {});
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* ── Top Navigation ──────────────────────────── */}
      <header className="glass shrink-0 z-50 border-b border-[var(--border)]">
        <div className="w-full px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--primary-subtle)] text-[var(--primary)] shadow-[var(--shadow-glow)] shrink-0">
              <Zap className="w-4 h-4" fill="currentColor" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-violet-700 to-cyan-700 bg-clip-text text-transparent truncate">
              VeriBuy AI
            </h1>
          </div>

          {/* Centered Navigation */}
          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-slate-100/80 p-1 shadow-sm">
            <button
              onClick={() => setActiveView("chat")}
              className={`h-9 px-4 rounded-xl flex items-center text-sm font-semibold transition-all ${
                activeView === "chat"
                  ? "text-[var(--text-primary)] bg-white shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/80"
              }`}
            >
              Chat
            </button>
            <button className="h-9 px-4 rounded-xl flex items-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/80 transition-all">
              Search
            </button>
            <button className="h-9 px-4 rounded-xl flex items-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/80 transition-all">
              Orders
            </button>
            <button className="h-9 px-4 rounded-xl flex items-center text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/80 transition-all">
              Profile
            </button>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--border)] bg-white hover:bg-slate-50 transition-colors text-[var(--text-secondary)] shadow-sm">
              {/* Dummy Sun Icon for light mode indicator */}
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            </button>
            <button
              onClick={() => setActiveView("dashboard")}
              className={`h-9 px-3 sm:px-4 rounded-xl text-sm font-semibold transition-all border ${
                activeView === "dashboard"
                  ? "text-white bg-[var(--primary)] border-[var(--primary)] shadow-[var(--shadow-glow)]"
                  : "text-[var(--text-primary)] border-[var(--border)] bg-white hover:bg-slate-50"
              }`}
            >
              Dashboard
              {researchData && activeView !== "dashboard" && (
                <span className="ml-1 inline-block w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {/* Chat View */}
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${
            activeView === "chat"
              ? "opacity-100 z-10 pointer-events-auto"
              : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          <ChatInterface onResearchComplete={handleResearchComplete} />
        </div>

        {/* Dashboard View */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ${
            activeView === "dashboard"
              ? "opacity-100 z-10 pointer-events-auto"
              : "opacity-0 z-0 pointer-events-none"
          }`}
        >
          {activeView === "dashboard" && <Dashboard data={researchData} />}
        </div>
      </div>
    </div>
  );
}
