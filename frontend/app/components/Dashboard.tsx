"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trophy, BarChart3, ExternalLink, ThumbsUp, ThumbsDown,
  ShoppingBag, Info, MessageCircle, Play, ArrowUp, Star,
  Sparkles, TrendingUp, Shield
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts";

interface DashboardProps { data: any; }

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
const RADAR_C = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: "easeOut" as const }
});

function sentiment(text: string) {
  const l = text.toLowerCase();
  const pos = ["great", "good", "love", "excellent", "best", "amazing", "recommend", "happy", "worth", "perfect", "solid", "smooth", "reliable", "impressive", "fantastic"].filter(w => l.includes(w)).length;
  const neg = ["bad", "worst", "terrible", "horrible", "issue", "problem", "broke", "poor", "waste", "disappointing", "avoid", "overpriced", "cheap", "flimsy", "regret"].filter(w => l.includes(w)).length;
  const t = pos + neg;
  if (t === 0) return { label: "Neutral", pct: 50, color: "#f59e0b" };
  const r = pos / t * 100;
  if (r >= 65) return { label: "Positive", pct: Math.round(r), color: "#10b981" };
  if (r <= 35) return { label: "Negative", pct: Math.round(100 - r), color: "#ef4444" };
  return { label: "Mixed", pct: 50, color: "#f59e0b" };
}

function AnimatedBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), delay * 1000); return () => clearTimeout(t); }, [pct, delay]);
  return <div className="h-5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${w}%`, background: color }} />;
}

export default function Dashboard({ data }: DashboardProps) {
  const [activeEvidence, setActiveEvidence] = useState<"reddit" | "youtube">("reddit");
  const [activeProductTab, setActiveProductTab] = useState<"exact" | "similar">("exact");

  const allProducts = data?.market?.products || [];
  const exactMatchProducts = allProducts.filter((p: any) => p.is_exact_match !== false);
  const similarProducts = allProducts.filter((p: any) => p.is_exact_match === false);

  useEffect(() => {
    if (exactMatchProducts.length === 0 && similarProducts.length > 0 && activeProductTab === "exact") {
      setActiveProductTab("similar");
    } else if (exactMatchProducts.length > 0 && activeProductTab === "similar" && similarProducts.length === 0) {
      setActiveProductTab("exact");
    }
  }, [exactMatchProducts.length, similarProducts.length]);

  if (!allProducts.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div {...fadeUp()} className="text-center max-w-md px-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-5">
            <BarChart3 className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Matches Found</h3>
          <p className="text-sm text-[var(--text-tertiary)] mb-4">
            We were unable to find listings on trusted sources for this product within your budget, but these exist elsewhere.
          </p>
          {data?.intent?.product_category && (
            <p className="text-xs text-[var(--text-tertiary)] italic">
              Query: {data.intent.product_category} {data.intent.budget_range?.max_price < 999999 ? `under ₹${data.intent.budget_range.max_price}` : ""}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  const { intent, market, reddit, youtube } = data;
  const productsToDisplay = activeProductTab === "exact" ? exactMatchProducts : similarProducts;
  const products = productsToDisplay;
  const topPick = products[0];
  const otherProducts = products.slice(1);
  const comments = reddit?.top_comments || [];
  const transcripts = youtube?.transcripts || [];
  const youtubeRecommendations = youtube?.recommendations || [];
  const youtubeAnalysis = youtube?.analysis || {};
  const youtubeEvidenceCount = youtube?.videos_considered || youtube?.videos_analyzed || transcripts.length;
  const youtubeEvidenceLabel = youtube?.evidence_mode === "metadata_fallback" ? "metadata" : "transcripts";
  const youtubeSources = (transcripts.length > 0 ? transcripts : youtube?.top_videos || []).slice(0, 10);

  const overallSent = comments.length > 0 ? sentiment(comments.map((c: any) => c.comment).join(" ")) : null;
  const redditSummary = comments.length > 0
    ? `Community discussion is ${overallSent?.label?.toLowerCase() || "mixed"} overall across ${reddit?.threads_analyzed || 0} threads. The strongest signals come from higher-ranked comments rather than marketplace ratings.`
    : "No Reddit sources were available for this query.";
  const redditRecommendation = comments.length > 0
    ? `Use Reddit as a caution layer: choose ${topPick?.name || "the top pick"} only if the recurring complaints below do not affect your use case.`
    : "No Reddit-backed recommendation is available yet.";
  const youtubeKeyInsight = youtubeAnalysis.summary
    || youtubeAnalysis.buying_advice?.[0]
    || (youtubeSources.length > 0
      ? "The ranked YouTube sources are useful for discovery, but transcript access was limited, so treat metadata-only insights as directional."
      : "No YouTube evidence was available for this query.");

  const radarData = products.length >= 2 ? (() => {
    const mx = Math.max(...products.map((p: any) => p.price || 0));
    return [
      { m: "Value", ...Object.fromEntries(products.slice(0, 4).map((p: any, i: number) => [`p${i}`, mx > 0 ? Math.round((1 - (p.price || 0) / mx) * 100) : 50])) },
      { m: "Features", ...Object.fromEntries(products.slice(0, 4).map((p: any, i: number) => [`p${i}`, Math.min((p.pros?.length || 0) * 30 + 20, 100)])) },
      { m: "Rating", ...Object.fromEntries(products.slice(0, 4).map((p: any, i: number) => [`p${i}`, (p.rating || 3.5) * 20])) },
      { m: "Reliability", ...Object.fromEntries(products.slice(0, 4).map((p: any, i: number) => [`p${i}`, p.availability === "in_stock" ? 90 : 40])) },
      { m: "Low Risk", ...Object.fromEntries(products.slice(0, 4).map((p: any, i: number) => [`p${i}`, Math.max(100 - (p.cons?.length || 0) * 30, 20)])) },
    ];
  })() : [];

  const hasTrustedSources = allProducts.some((p: any) => p.is_trusted);
  const showUntrustedWarning = allProducts.length > 0 && !hasTrustedSources;

  return (
    <div className="dashboard-root h-full w-full overflow-y-auto flex flex-col items-center" style={{ background: "var(--bg-app)" }}>
      <div className="w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-7 space-y-6">

        {/* ─── HEADER ─── */}
        <motion.div {...fadeUp(0)} className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-2">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>Research Results</h2>
            <p className="text-sm mt-1 capitalize" style={{ color: "var(--text-tertiary)" }}>
              {intent?.product_category}
              {intent?.usage_context !== "general" ? ` · ${intent?.usage_context}` : ""}
              {intent?.budget_range?.max_price < 999999 ? ` · Budget ₹${intent?.budget_range?.max_price?.toLocaleString()}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {overallSent && (
              <span className="stat-chip" style={{ borderColor: overallSent.color + "30", background: overallSent.color + "12", color: overallSent.color }}>
                <Star className="w-3 h-3" /> {overallSent.label} ({overallSent.pct}%)
              </span>
            )}
            <span className="stat-chip" style={{ background: "rgba(5,150,105,0.08)", color: "#059669", borderColor: "rgba(5,150,105,0.2)" }}>
              <ShoppingBag className="w-3 h-3" /> {market.total_found} Matches
            </span>
            {reddit?.threads_analyzed > 0 && (
              <span className="stat-chip" style={{ background: "rgba(234,88,12,0.08)", color: "#ea580c", borderColor: "rgba(234,88,12,0.2)" }}>
                <MessageCircle className="w-3 h-3" /> {reddit.threads_analyzed} Threads
              </span>
            )}
            {youtubeEvidenceCount > 0 && (
              <span className="stat-chip" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", borderColor: "rgba(220,38,38,0.2)" }}>
                <Play className="w-3 h-3" /> {youtubeEvidenceCount} YouTube
              </span>
            )}
          </div>
        </motion.div>

        {showUntrustedWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-3 shadow-sm"
          >
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block mb-1">Notice: Trusted Sources Unavailable</strong>
              We were unable to find listings on trusted sources for this product, but these exist.
            </div>
          </motion.div>
        )}

        {/* ─── TAB SELECTOR FOR EXACT VS SIMILAR ─── */}
        {similarProducts.length > 0 && (
          <div className="flex justify-start">
            <div className="tab-bar">
              <button
                onClick={() => setActiveProductTab("exact")}
                className={`tab-item ${activeProductTab === "exact" ? "active" : ""}`}
                disabled={exactMatchProducts.length === 0}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Exact Matches ({exactMatchProducts.length})
              </button>
              <button
                onClick={() => setActiveProductTab("similar")}
                className={`tab-item ${activeProductTab === "similar" ? "active" : ""}`}
                disabled={similarProducts.length === 0}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Similar Products ({similarProducts.length})
              </button>
            </div>
          </div>
        )}

        {/* ─── TOP PICK SPOTLIGHT ─── */}
        {topPick && (
          <motion.div {...fadeUp(0.1)} className="card card-hover relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1" style={{ background: "linear-gradient(90deg, var(--primary) 0%, #7c3aed 50%, #06b6d4 100%)" }} />
            <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:gap-8">
              {/* Image */}
              <div className="sm:w-[200px] shrink-0 flex items-center justify-center">
                {topPick.image_url ? (
                  <div className="w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                    <img src={topPick.image_url} alt={topPick.name} className="w-full h-full object-contain p-3" />
                  </div>
                ) : (
                  <div className="w-full aspect-square rounded-xl flex items-center justify-center" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                    <ShoppingBag className="w-12 h-12" style={{ color: "var(--text-tertiary)" }} />
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center pt-3">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="badge text-white" style={{ background: "linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%)" }}>
                    <Trophy className="w-3 h-3" /> #1 Top Pick
                  </span>
                  {topPick.platform && (
                    <span className="badge" style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid rgba(14,165,233,0.2)" }}>
                      {topPick.platform}
                    </span>
                  )}
                  {!topPick.is_trusted && (
                    <span className="badge" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                      ⚠️ Untrusted Source
                    </span>
                  )}
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-1 leading-snug" style={{ color: "var(--text-primary)" }}>{topPick.name}</h3>
                {topPick.disclaimer && (
                  <p className="text-xs text-red-500 font-semibold my-2 bg-red-50 p-2.5 rounded-lg border border-red-100 leading-normal">{topPick.disclaimer}</p>
                )}
                {topPick.brand && <p className="text-sm mb-3" style={{ color: "var(--text-tertiary)" }}>{topPick.brand}{topPick.model ? ` · ${topPick.model}` : ""}</p>}

                {topPick.relevance_score !== undefined && (
                  <div className="mb-4 p-3 rounded-xl border bg-indigo-50/40 border-indigo-100 text-xs">
                    <span className="font-bold text-indigo-700 block mb-1">🔍 Relevance Match: {Math.round(topPick.relevance_score * 100)}%</span>
                    <p className="text-indigo-600 leading-normal mb-0">{topPick.relevance_reason || "Matches category and requirements constraint."}</p>
                  </div>
                )}

                <p className="text-3xl font-extrabold mb-4" style={{ color: "var(--primary)" }}>₹{topPick.price?.toLocaleString()}</p>
                
                {topPick.specs && Object.keys(topPick.specs).length > 0 && (
                  <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                    <div className="font-semibold text-slate-700 mb-2">Key Specifications</div>
                    <div className="space-y-1 text-xs text-slate-600">
                      {Object.entries(topPick.specs).slice(0, 3).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium text-slate-700 capitalize">{key.replace(/_/g, ' ')}:</span>
                          <span className="text-slate-600">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2 mb-5">
                  {topPick.pros?.map((p: string, i: number) => (
                    <span key={i} className="badge" style={{ background: "rgba(5,150,105,0.08)", color: "#059669", border: "1px solid rgba(5,150,105,0.18)" }}>✓ {p}</span>
                  ))}
                  {topPick.cons?.map((c: string, i: number) => (
                    <span key={i} className="badge" style={{ background: "rgba(220,38,38,0.07)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.15)" }}>✗ {c}</span>
                  ))}
                </div>
                {topPick.url && (
                  <a href={topPick.url} target="_blank" rel="noopener noreferrer"
                    className="btn btn-primary w-fit text-sm"
                    style={{ borderRadius: "10px" }}
                  >
                    View on {topPick.platform || "Store"} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── BEST DEALS FINDER (NEW) ─── */}
        {data?.best_deals && data.best_deals.length > 0 && (
          <motion.div {...fadeUp(0.15)} className="premium-card rounded-2xl p-5 sm:p-6 overflow-hidden relative">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-500" />
              Best Deals for Top Pick
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {data.best_deals.map((deal: any, i: number) => {
                const isCheapest = i === 0;
                return (
                  <a
                    key={i}
                    href={deal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block p-5 rounded-xl border transition-all duration-200 hover:-translate-y-1 ${isCheapest
                        ? 'border-emerald-400/40 bg-emerald-50 hover:shadow-lg hover:shadow-emerald-500/10'
                        : 'border-[var(--border)] bg-white hover:shadow-md hover:border-[var(--border-hover)]'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[var(--text-tertiary)] truncate">{deal.platform || 'Store'}</span>
                      {isCheapest && <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shrink-0">BEST PRICE</span>}
                    </div>
                    <div className="text-xl font-extrabold text-[var(--text-primary)] mb-1">
                      ₹{deal.price?.toLocaleString()}
                    </div>
                    {!isCheapest && data.best_deals[0].price > 0 && (
                      <div className="text-xs text-red-500 font-medium">
                        +₹{(deal.price - data.best_deals[0].price).toLocaleString()}
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
            {data.best_deals.length > 1 && data.best_deals[data.best_deals.length - 1].price - data.best_deals[0].price > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-700">
                  You save <strong>₹{(data.best_deals[data.best_deals.length - 1].price - data.best_deals[0].price).toLocaleString()}</strong> by choosing the best deal over the highest price!
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── OTHER PRODUCTS ─── */}
        {otherProducts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherProducts.map((product: any, idx: number) => (
              <motion.div key={idx} {...fadeUp(0.2 + idx * 0.08)} className="card card-hover flex flex-col overflow-hidden">
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "var(--primary-subtle)", color: "var(--primary)" }}>#{idx + 2}</div>
                    {product.platform && (
                      <span className="badge" style={{ background: "var(--surface-1)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }}>
                        {product.platform}
                      </span>
                    )}
                  </div>
                  {!product.is_trusted && (
                    <div className="text-[11px] text-red-500 font-semibold mb-2 bg-red-50 p-2 rounded border border-red-100">
                      ⚠️ Untrusted Source
                    </div>
                  )}
                  {product.image_url ? (
                    <div className="w-full h-32 mb-3 rounded-lg flex items-center justify-center overflow-hidden" style={{ background: "var(--surface-1)" }}>
                      <img src={product.image_url} alt={product.name} className="max-w-full max-h-full object-contain p-2" />
                    </div>
                  ) : (
                    <div className="w-full h-32 mb-3 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-1)" }}>
                      <ShoppingBag className="w-7 h-7" style={{ color: "var(--text-tertiary)" }} />
                    </div>
                  )}
                  <h4 className="font-semibold text-[13px] mb-1 leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>{product.name}</h4>

                  {product.relevance_score !== undefined && (
                    <div className="my-2 p-2 rounded bg-indigo-50/30 border border-indigo-50 text-[11px] text-indigo-700 leading-normal">
                      <strong>Relevance: {Math.round(product.relevance_score * 100)}%</strong>
                      <p className="mt-0.5 text-indigo-600/90 leading-tight mb-0">{product.relevance_reason}</p>
                    </div>
                  )}

                  {product.brand && <p className="text-[11px] mb-2" style={{ color: "var(--text-tertiary)" }}>{product.brand}</p>}
                  <p className="text-xl font-extrabold mb-3" style={{ color: "var(--primary)" }}>₹{product.price?.toLocaleString()}</p>
                  
                  {product.specs && Object.keys(product.specs).length > 0 && (
                    <div className="mb-2 p-2 rounded bg-slate-50 border border-slate-100 text-[10px] space-y-0.5 flex-1">
                      <div className="font-semibold text-slate-600 mb-1">Specs</div>
                      {Object.entries(product.specs).slice(0, 2).map(([key, value]: [string, any]) => (
                        <div key={key} className="flex justify-between text-slate-500">
                          <span className="font-medium">{key.replace(/_/g, ' ').substring(0, 10)}:</span>
                          <span className="text-right text-slate-600">{String(value).substring(0, 15)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="space-y-1.5 mb-3 flex-1">
                    {product.pros?.slice(0, 2).map((p: string, i: number) => (
                      <p key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        <span className="shrink-0 mt-0.5" style={{ color: "#059669" }}>✓</span>{p}
                      </p>
                    ))}
                    {product.cons?.slice(0, 1).map((c: string, i: number) => (
                      <p key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                        <span className="shrink-0 mt-0.5" style={{ color: "#dc2626" }}>✗</span>{c}
                      </p>
                    ))}
                  </div>
                  <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    {product.url ? (
                      <a href={product.url} target="_blank" rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-colors"
                        style={{ background: "var(--primary)" }}
                      >View on {product.platform || "Store"} <ExternalLink className="w-3 h-3" /></a>
                    ) : (
                      <button disabled className="w-full py-2.5 rounded-xl text-xs font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-tertiary)" }}>Link Unavailable</button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── CHARTS ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {products.length > 1 && (
            <motion.div {...fadeUp(0.35)} className="premium-card rounded-2xl p-5 sm:p-6 overflow-hidden">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[var(--primary)]" /> Price Comparison</h3>
              <div className="h-[300px] w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1}>
                  <BarChart data={products.map((p: any, i: number) => ({ name: p.brand || p.name?.split(" ").slice(0, 2).join(" ") || `#${i + 1}`, price: p.price || 0 }))} layout="vertical" margin={{ left: 5, right: 30, top: 5, bottom: 5 }}>
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, "Price"]} />
                    <Bar dataKey="price" radius={[0, 8, 8, 0]} barSize={36}>{products.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.9} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
          {radarData.length > 0 && (
            <motion.div {...fadeUp(0.4)} className="premium-card rounded-2xl p-5 sm:p-6 overflow-hidden">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2"><Shield className="w-4 h-4 text-[var(--primary)]" /> Quality Comparison</h3>
              <div className="h-[300px] w-full min-w-0 overflow-hidden">
                <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1}>
                  <RadarChart data={radarData} outerRadius="68%">
                    <PolarGrid stroke="rgba(148,163,184,0.22)" />
                    <PolarAngleAxis dataKey="m" tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    {products.slice(0, 4).map((p: any, i: number) => <Radar key={i} name={p.brand || p.name?.split(" ").slice(0, 2).join(" ") || `#${i + 1}`} dataKey={`p${i}`} stroke={RADAR_C[i % 4]} fill={RADAR_C[i % 4]} fillOpacity={0.12} strokeWidth={2} />)}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>

        {/* Detailed Spec Comparison Table */}
        {products.length > 1 && (
          <motion.div {...fadeUp(0.44)} className="premium-card rounded-2xl p-5 sm:p-6 overflow-hidden">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
              Detailed Specifications Comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-3 px-4 text-[var(--text-tertiary)] font-bold w-1/4">Specification</th>
                    {products.slice(0, 4).map((p: any, i: number) => (
                      <th key={i} className="py-3 px-4 font-bold text-[var(--text-primary)] w-1/4">
                        <div className="flex flex-col text-left">
                          <span className="text-indigo-500 font-bold mb-0.5">Option #{i + 1}</span>
                          <span className="truncate max-w-[150px] text-[var(--text-primary)]" title={p.name}>{p.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Brand Row */}
                  <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-secondary)]">Brand</td>
                    {products.slice(0, 4).map((p: any, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-[var(--text-primary)]">{p.brand || "–"}</td>
                    ))}
                  </tr>
                  {/* Price Row */}
                  <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-secondary)]">Price</td>
                    {products.slice(0, 4).map((p: any, i: number) => (
                      <td key={i} className="py-2.5 px-4 font-bold text-[var(--primary)]">₹{p.price?.toLocaleString() || "–"}</td>
                    ))}
                  </tr>
                  {/* Rating Row */}
                  <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-secondary)]">Rating</td>
                    {products.slice(0, 4).map((p: any, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-[var(--text-primary)]">
                        {p.rating ? `${p.rating} / 5 (${p.review_count || 0} reviews)` : "–"}
                      </td>
                    ))}
                  </tr>
                  {/* Dynamic Specs Rows */}
                  {(() => {
                    const allKeys = Array.from(
                      new Set(
                        products.slice(0, 4).flatMap((p: any) => Object.keys(p.specs || {}))
                      )
                    ) as string[];
                    if (allKeys.length === 0) return null;
                    return allKeys.map((key) => (
                      <tr key={key} className="border-b border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-[var(--text-secondary)] capitalize">{key.replace(/_/g, ' ')}</td>
                        {products.slice(0, 4).map((p: any, i: number) => (
                          <td key={i} className="py-2.5 px-4 text-[var(--text-primary)]">{p.specs[key] || "–"}</td>
                        ))}
                      </tr>
                    ));
                  })()}
                  {/* Pros Row */}
                  <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-secondary)] align-top">Key Pros</td>
                    {products.slice(0, 4).map((p: any, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-[var(--text-primary)] align-top">
                        {p.pros && p.pros.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-0.5">
                            {p.pros.slice(0, 3).map((pro: string, idx: number) => (
                              <li key={idx} className="text-[11px] text-emerald-600">{pro}</li>
                            ))}
                          </ul>
                        ) : "–"}
                      </td>
                    ))}
                  </tr>
                  {/* Cons Row */}
                  <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-secondary)] align-top">Key Cons</td>
                    {products.slice(0, 4).map((p: any, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-[var(--text-primary)] align-top">
                        {p.cons && p.cons.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-0.5">
                            {p.cons.slice(0, 3).map((con: string, idx: number) => (
                              <li key={idx} className="text-[11px] text-red-500">{con}</li>
                            ))}
                          </ul>
                        ) : "–"}
                      </td>
                    ))}
                  </tr>
                  {/* Confidence & Trust */}
                  <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-1)] transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-secondary)]">Trust Score</td>
                    {products.slice(0, 4).map((p: any, i: number) => (
                      <td key={i} className="py-2.5 px-4 text-[var(--text-primary)]">
                        {p.trust_score !== undefined ? `${Math.round(p.trust_score * 100)}%` : "–"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        <motion.div {...fadeUp(0.48)} className="premium-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" /> Community Evidence
              </h3>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Switch between community discussion and creator review evidence.</p>
            </div>
            <div className="inline-flex p-1 rounded-2xl bg-slate-100 border border-[var(--border)] w-fit">
              <button onClick={() => setActiveEvidence("reddit")} className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${activeEvidence === "reddit" ? "bg-white text-orange-600 shadow-sm border border-orange-200" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`} title="Reddit intelligence">
                <MessageCircle className="w-5 h-5" />
              </button>
              <button onClick={() => setActiveEvidence("youtube")} className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${activeEvidence === "youtube" ? "bg-white text-red-600 shadow-sm border border-red-200" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`} title="YouTube intelligence">
                <Play className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Reddit tab */}
          {activeEvidence === "reddit" ? (
            <div className="p-5 space-y-5">
              {/* Summary + Recommendation row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl p-4" style={{ background: "rgba(234,88,12,0.06)", border: "1px solid rgba(234,88,12,0.18)" }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[12px] font-bold" style={{ color: "#ea580c" }}>Reddit Summary</span>
                    <span className="badge" style={{ background: "#fff", color: "#ea580c", border: "1px solid rgba(234,88,12,0.2)" }}>{reddit?.threads_analyzed || 0} threads</span>
                  </div>
                  <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>{redditSummary}</p>

                  {reddit?.analysis?.pros?.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[11px] font-bold text-emerald-600 block mb-1">PROS HIGHLIGHTED BY REDDIT:</span>
                      <ul className="list-disc pl-4 space-y-1">
                        {reddit.analysis.pros.map((p: string, i: number) => (
                          <li key={i} className="text-xs text-emerald-700 leading-snug">{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {reddit?.analysis?.cons?.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-red-600 block mb-1">CONS HIGHLIGHTED BY REDDIT:</span>
                      <ul className="list-disc pl-4 space-y-1">
                        {reddit.analysis.cons.map((c: string, i: number) => (
                          <li key={i} className="text-xs text-red-600 leading-snug">{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="rounded-xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                  <div className="text-[11px] font-bold mb-2" style={{ color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommendation</div>
                  <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{redditRecommendation}</p>
                  {overallSent && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${overallSent.pct}%`, background: overallSent.color }} />
                      </div>
                      <span className="text-[12px] font-bold" style={{ color: overallSent.color }}>{overallSent.label}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Comment cards */}
              <div>
                <div className="text-[11px] font-bold mb-3" style={{ color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reddit Sources</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {comments.slice(0, 8).map((c: any, i: number) => {
                    const s = sentiment(c.comment);
                    return (
                      <div key={i} className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="badge" style={{ background: s.color + "12", color: s.color, border: "1px solid " + s.color + "30" }}>{s.label}</span>
                          <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                            <ArrowUp className="w-3 h-3" />{c.upvotes}
                          </span>
                        </div>
                        <p className="text-[12.5px] leading-relaxed line-clamp-4" style={{ color: "var(--text-secondary)" }}>&ldquo;{c.comment}&rdquo;</p>
                        {c.thread_title && <p className="text-[11px] line-clamp-1" style={{ color: "var(--text-tertiary)" }}>{c.thread_title}</p>}
                        {c.thread_url && (
                          <a href={c.thread_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold mt-auto" style={{ color: "#ea580c" }}>View source thread →</a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              <div className="rounded-xl bg-red-50 border border-red-200 p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-bold text-red-600">Key YouTube Insight</span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white text-red-600 border border-red-200">{youtubeEvidenceCount} {youtubeEvidenceLabel}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed break-words">{youtubeKeyInsight}</p>
              </div>

              {/* YouTube Video Sources */}
              {youtubeSources.length > 0 && (
                <div className="mb-5">
                  <div className="text-[11px] font-bold mb-3" style={{ color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Video Sources</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {youtubeSources.slice(0, 6).map((video: any, i: number) => (
                      <a
                        key={i}
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-4 rounded-xl border border-red-100 bg-white hover:shadow-md hover:border-red-300 transition-all duration-200 hover:-translate-y-0.5 group block"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Play className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600">Video</span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 group-hover:text-red-600 transition-colors mb-1">{video.title}</h4>
                        {video.channel && <p className="text-[10px] text-slate-500 mb-2">📺 {video.channel}</p>}
                        {video.view_count && <p className="text-[10px] text-slate-400">👁️ {video.view_count?.toLocaleString?.()} views</p>}
                        {video.evidence_type && (
                          <span className="text-[9px] font-medium text-slate-500 mt-2 inline-block">
                            {video.evidence_type === 'transcript' ? '✓ Transcript' : '📌 Metadata'}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* YouTube Analysis & Recommendations */}
              {(youtubeRecommendations.length > 0 || youtubeAnalysis.buying_advice?.length > 0) && (
                <div className="p-4 rounded-xl border border-red-100 bg-red-50/20 space-y-4">
                  <span className="text-xs font-bold text-red-600 block">YouTube Creator Recommendations & Advice</span>
                  {youtubeRecommendations.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {youtubeRecommendations.slice(0, 4).map((item: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg bg-white border border-red-100 shadow-sm text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-800 line-clamp-1">{item.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                              {Math.round((item.confidence_score || 0.8) * 100)}% Match
                            </span>
                          </div>
                          {item.best_for && <p className="text-[10px] text-slate-500 mb-1"><strong>Best for:</strong> {item.best_for}</p>}
                          {item.why_recommended && <p className="text-[11px] text-slate-600 leading-snug mt-1">{item.why_recommended}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {youtubeAnalysis.buying_advice?.length > 0 && (
                    <div className="pt-2 border-t border-red-100/60">
                      <span className="text-[11px] font-bold text-red-500 block mb-1">Creator Buying Guide:</span>
                      <ul className="list-disc pl-4 space-y-1">
                        {youtubeAnalysis.buying_advice.map((advice: string, i: number) => (
                          <li key={i} className="text-xs text-slate-600 leading-snug">{advice}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </motion.div>



        {/* ─── COMMUNITY INTELLIGENCE ─── */}
        <div className="hidden">
          {comments.length > 0 && (
            <motion.div {...fadeUp(0.5)} className="rounded-2xl border border-white/40 p-6" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)" }}>
              <h3 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-orange-500" /> Reddit Insights <span className="text-xs font-normal text-slate-400 ml-1">{reddit?.threads_analyzed} threads</span></h3>
              <div className="space-y-3">
                {comments.slice(0, 4).map((c: any, i: number) => {
                  const s = sentiment(c.comment); return (
                    <div key={i} className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-orange-200 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.color + "12", color: s.color }}>{s.label}</span>
                        <span className="flex items-center gap-1 text-xs text-slate-400"><ArrowUp className="w-3 h-3" />{c.upvotes}</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">&ldquo;{c.comment}&rdquo;</p>
                      {c.thread_url && <a href={c.thread_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-500 hover:underline mt-2 inline-block font-medium">View thread →</a>}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* ─── SENTIMENT ─── */}
        {comments.length > 0 && (() => {
          let pos = 0, neg = 0, neu = 0;
          comments.forEach((c: any) => { const s = sentiment(c.comment); if (s.label === "Positive") pos++; else if (s.label === "Negative") neg++; else neu++; });
          const t = pos + neg + neu; const pP = Math.round(pos / t * 100); const nP = Math.round(neg / t * 100); const mP = 100 - pP - nP;
          return (
            <motion.div {...fadeUp(0.65)} className="premium-card rounded-2xl p-5 sm:p-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-5 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-300" /> Customer Sentiment Analysis</h3>
              <div className="space-y-4">
                {[{ l: "Positive", p: pP, c: "#10b981", d: 0.3 }, { l: "Neutral", p: mP, c: "#f59e0b", d: 0.5 }, { l: "Negative", p: nP, c: "#ef4444", d: 0.7 }].map(b => (
                  <div key={b.l} className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-[var(--text-tertiary)] w-16">{b.l}</span>
                    <div className="flex-1 h-5 bg-slate-200 rounded-full overflow-hidden"><AnimatedBar pct={b.p} color={b.c} delay={b.d} /></div>
                    <span className="text-sm font-bold w-12 text-right" style={{ color: b.c }}>{b.p}%</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })()}

        {/* ─── AI VERDICT ─── */}
        <motion.div {...fadeUp(0.75)} className="premium-card rounded-2xl p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20"><Sparkles className="w-5 h-5 text-white" /></div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">AI Recommendation</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                Based on price analysis, community reviews, and feature comparison, <strong className="text-indigo-700">{topPick?.name}</strong> at <strong className="text-indigo-700">₹{topPick?.price?.toLocaleString()}</strong> offers the best overall value
                {intent?.usage_context !== "general" ? ` for ${intent.usage_context}` : ""} in your budget.
                {comments.length > 0 ? ` Reddit users highlight ${overallSent?.label?.toLowerCase()} experiences overall.` : ""}
                {transcripts.length > 0 ? " YouTube reviewers corroborate these findings." : ""}
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
