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

const COLORS = ["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444"];
const RADAR_C = ["#6366f1","#06b6d4","#10b981","#f59e0b"];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: "easeOut" as const }
});

function sentiment(text: string) {
  const l = text.toLowerCase();
  const pos = ["great","good","love","excellent","best","amazing","recommend","happy","worth","perfect","solid","smooth","reliable","impressive","fantastic"].filter(w => l.includes(w)).length;
  const neg = ["bad","worst","terrible","horrible","issue","problem","broke","poor","waste","disappointing","avoid","overpriced","cheap","flimsy","regret"].filter(w => l.includes(w)).length;
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

  if (!data?.market?.products?.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div {...fadeUp()} className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto mb-5">
            <BarChart3 className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">No Research Data Yet</h3>
          <p className="text-sm text-[var(--text-tertiary)]">Start a conversation to see product analysis here.</p>
        </motion.div>
      </div>
    );
  }

  const { intent, market, reddit, youtube } = data;
  const products = market.products || [];
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
      { m: "Value", ...Object.fromEntries(products.slice(0,4).map((p:any,i:number) => [`p${i}`, mx > 0 ? Math.round((1-(p.price||0)/mx)*100) : 50])) },
      { m: "Features", ...Object.fromEntries(products.slice(0,4).map((p:any,i:number) => [`p${i}`, Math.min((p.pros?.length||0)*30+20, 100)])) },
      { m: "Rating", ...Object.fromEntries(products.slice(0,4).map((p:any,i:number) => [`p${i}`, (p.rating||3.5)*20])) },
      { m: "Reliability", ...Object.fromEntries(products.slice(0,4).map((p:any,i:number) => [`p${i}`, p.availability==="in_stock"?90:40])) },
      { m: "Low Risk", ...Object.fromEntries(products.slice(0,4).map((p:any,i:number) => [`p${i}`, Math.max(100-(p.cons?.length||0)*30, 20)])) },
    ];
  })() : [];

  return (
    <div className="veribuy-dashboard h-full w-full overflow-y-auto flex flex-col items-center bg-transparent">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* ─── HEADER ─── */}
        <motion.div {...fadeUp(0)} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-slate-950 via-violet-700 to-cyan-700 bg-clip-text text-transparent tracking-tight">Research Results</h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-1 capitalize">{intent?.product_category}{intent?.usage_context !== "general" ? ` for ${intent?.usage_context}` : ""}{intent?.budget_range?.max_price < 999999 ? ` • Budget ₹${intent?.budget_range?.max_price?.toLocaleString()}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {overallSent && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ borderColor: overallSent.color+"30", background: overallSent.color+"10", color: overallSent.color }}>
                <Star className="w-3.5 h-3.5" /> {overallSent.label} ({overallSent.pct}%)
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ShoppingBag className="w-3.5 h-3.5" /> {market.total_found} Matches
            </span>
            {reddit?.threads_analyzed > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200">
                <MessageCircle className="w-3.5 h-3.5" /> {reddit.threads_analyzed} Threads
              </span>
            )}
            {youtubeEvidenceCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                <Play className="w-3.5 h-3.5" /> {youtubeEvidenceCount} YouTube
              </span>
            )}
          </div>
        </motion.div>

        {/* ─── TOP PICK SPOTLIGHT ─── */}
        {topPick && (
          <motion.div {...fadeUp(0.1)} className="premium-card premium-card-hover relative rounded-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <div className="p-6 sm:p-8 md:p-10 flex flex-col md:flex-row gap-8 md:gap-10">
              <div className="md:w-2/5 flex items-center justify-center">
                {topPick.image_url ? (
                  <div className="muted-surface w-full max-w-[280px] aspect-square rounded-2xl p-4 shadow-md flex items-center justify-center">
                    <img src={topPick.image_url} alt={topPick.name} className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="muted-surface w-full max-w-[280px] aspect-square rounded-2xl flex items-center justify-center"><ShoppingBag className="w-16 h-16 text-[var(--text-tertiary)]" /></div>
                )}
              </div>
              <div className="md:w-3/5 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex items-center gap-1"><Trophy className="w-3 h-3" /> #1 TOP PICK</span>
                  {topPick.platform && <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">{topPick.platform}</span>}
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-2 leading-tight break-words">{topPick.name}</h3>
                {topPick.brand && <p className="text-sm text-slate-500 mb-4">{topPick.brand}{topPick.model ? ` · ${topPick.model}` : ""}</p>}
                <p className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-6">₹{topPick.price?.toLocaleString()}</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {topPick.pros?.map((p: string, i: number) => <span key={i} className="max-w-full px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 break-words">✓ {p}</span>)}
                  {topPick.cons?.map((c: string, i: number) => <span key={i} className="max-w-full px-3 py-1.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200 break-words">✗ {c}</span>)}
                </div>
                {topPick.url && (
                  <a href={topPick.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-0.5 w-fit">
                    View on {topPick.platform || "Store"} <ExternalLink className="w-4 h-4" />
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
                    className={`block p-5 rounded-xl border transition-all duration-200 hover:-translate-y-1 ${
                      isCheapest 
                        ? 'border-emerald-400/40 bg-emerald-50 hover:shadow-lg hover:shadow-emerald-500/10' 
                        : 'border-[var(--border)] bg-white hover:shadow-md hover:border-[var(--border-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[var(--text-tertiary)]">{deal.platform || 'Store'}</span>
                      {isCheapest && <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">BEST PRICE</span>}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {otherProducts.map((product: any, idx: number) => (
              <motion.div key={idx} {...fadeUp(0.2 + idx * 0.08)} className="premium-card premium-card-hover rounded-2xl p-6 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold bg-slate-100 text-[var(--text-secondary)]">#{idx + 2}</div>
                  {product.platform && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{product.platform}</span>}
                </div>
                {product.image_url ? (
                  <div className="muted-surface w-full h-36 mb-4 rounded-xl p-2 flex items-center justify-center shadow-sm"><img src={product.image_url} alt={product.name} className="max-w-full max-h-full object-contain" /></div>
                ) : (
                  <div className="muted-surface w-full h-36 mb-4 rounded-xl flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-[var(--text-tertiary)]" /></div>
                )}
                <h4 className="font-bold text-sm text-[var(--text-primary)] mb-1 line-clamp-2 break-words">{product.name}</h4>
                {product.brand && <p className="text-xs text-slate-400 mb-3">{product.brand}</p>}
                <p className="text-2xl font-extrabold text-indigo-600 mb-4">₹{product.price?.toLocaleString()}</p>
                <div className="space-y-2 mb-4 flex-1">
                  {product.pros?.slice(0,2).map((p:string,i:number) => <p key={i} className="text-xs text-slate-600 flex items-start gap-1.5 break-words"><span className="text-emerald-500 mt-0.5 shrink-0">✓</span>{p}</p>)}
                  {product.cons?.slice(0,1).map((c:string,i:number) => <p key={i} className="text-xs text-slate-600 flex items-start gap-1.5 break-words"><span className="text-red-400 mt-0.5 shrink-0">✗</span>{c}</p>)}
                </div>
                <div className="mt-auto pt-3 border-t border-[var(--border)]">
                  {product.url ? (
                    <a href={product.url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-colors">View on {product.platform || "Store"} <ExternalLink className="w-3.5 h-3.5" /></a>
                  ) : (
                    <button disabled className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed">Link Unavailable</button>
                  )}
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
                  <BarChart data={products.map((p:any,i:number) => ({ name: p.brand || p.name?.split(" ").slice(0,2).join(" ") || `#${i+1}`, price: p.price||0 }))} layout="vertical" margin={{ left: 5, right: 30, top: 5, bottom: 5 }}>
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} formatter={(v:any) => [`₹${Number(v).toLocaleString()}`, "Price"]} />
                    <Bar dataKey="price" radius={[0,8,8,0]} barSize={36}>{products.map((_:any,i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]} fillOpacity={0.9} />)}</Bar>
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
                    <PolarRadiusAxis angle={30} domain={[0,100]} tick={false} axisLine={false} />
                    {products.slice(0,4).map((p:any,i:number) => <Radar key={i} name={p.brand || p.name?.split(" ").slice(0,2).join(" ") || `#${i+1}`} dataKey={`p${i}`} stroke={RADAR_C[i%4]} fill={RADAR_C[i%4]} fillOpacity={0.12} strokeWidth={2} />)}
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </div>

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

          {activeEvidence === "reddit" ? (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-4">
                <div className="rounded-xl bg-orange-50 border border-orange-200 p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-bold text-orange-600">Reddit Summary</span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-white text-orange-500 border border-orange-100">{reddit?.threads_analyzed || 0} threads</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed break-words">{redditSummary}</p>
                </div>
                <div className="soft-panel p-5">
                  <div className="text-xs font-bold text-[var(--text-tertiary)] mb-3">Separate Recommendation</div>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed break-words">{redditRecommendation}</p>
                  {overallSent && (
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${overallSent.pct}%`, background: overallSent.color }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: overallSent.color }}>{overallSent.label}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-[var(--text-tertiary)] mb-3">Reddit Sources</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {comments.slice(0, 8).map((c: any, i: number) => {
                    const s = sentiment(c.comment);
                    return (
                      <div key={i} className="soft-panel p-5 hover:border-orange-300 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.color + "12", color: s.color }}>{s.label}</span>
                          <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]"><ArrowUp className="w-3 h-3" />{c.upvotes}</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3 break-words">&ldquo;{c.comment}&rdquo;</p>
                        {c.thread_title && <p className="text-[10px] text-[var(--text-tertiary)] mt-2 line-clamp-1">{c.thread_title}</p>}
                        {c.thread_url && <a href={c.thread_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-500 hover:underline mt-2 inline-block font-medium">View source -&gt;</a>}
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

              <div>
                <div className="text-xs font-bold text-[var(--text-tertiary)] mb-3">Top Ranked YouTube Sources</div>
                <div className="max-h-[560px] overflow-y-auto pr-1 space-y-3">
                  {youtubeSources.map((v: any, i: number) => (
                    <div key={v.video_id || v.url || i} className="soft-panel p-5 hover:border-red-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center text-xs font-extrabold shrink-0">{i + 1}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-sm font-bold text-[var(--text-primary)] leading-snug line-clamp-2 break-words">{v.title}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 shrink-0">{v.evidence_type || youtubeEvidenceLabel}</span>
                          </div>
                          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed line-clamp-2 mt-1 break-words">{(v.transcript_snippet || v.snippet || "No snippet available.").slice(0, 260)}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            {v.channel && <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500">{v.channel}</span>}
                            {v.duration && <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500">{v.duration}</span>}
                            {v.rank_reasons?.slice(0, 3).map((reason: string, idx: number) => (
                              <span key={idx} className="text-[10px] font-medium px-2 py-1 rounded-full bg-red-50 text-red-500">{reason}</span>
                            ))}
                          </div>
                          {v.url && <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-red-500 hover:underline mt-3 inline-flex items-center gap-1 font-semibold"><Play className="w-3 h-3" /> Watch on YouTube</a>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {false && (youtubeRecommendations.length > 0 || youtubeAnalysis.summary || youtubeAnalysis.buying_advice?.length > 0) && (
          <motion.div {...fadeUp(0.48)} className="rounded-2xl border border-red-100 p-6 bg-white shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2">
              <Play className="w-4 h-4 text-red-500" /> YouTube Product Intelligence
              <span className="text-xs font-normal text-slate-400 ml-1">{youtubeEvidenceCount} {youtubeEvidenceLabel}</span>
            </h3>
            {youtubeAnalysis.summary && (
              <p className="text-sm text-slate-600 leading-relaxed mb-5">{youtubeAnalysis.summary}</p>
            )}
            {youtubeRecommendations.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {youtubeRecommendations.slice(0, 3).map((item: any, i: number) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-2">{item.name}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-500 shrink-0">
                        {Math.round((item.confidence_score || 0) * 100)}%
                      </span>
                    </div>
                    {item.best_for && <p className="text-xs text-slate-500 mb-3">{item.best_for}</p>}
                    {item.why_recommended && <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-3">{item.why_recommended}</p>}
                    <div className="space-y-1">
                      {item.pros?.slice(0, 2).map((pro: string, idx: number) => (
                        <p key={idx} className="text-[11px] text-emerald-700">+ {pro}</p>
                      ))}
                      {item.cons?.slice(0, 1).map((con: string, idx: number) => (
                        <p key={idx} className="text-[11px] text-red-600">- {con}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {youtubeAnalysis.buying_advice?.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2">
                {youtubeAnalysis.buying_advice.slice(0, 4).map((advice: string, i: number) => (
                  <p key={i} className="text-xs text-slate-600 leading-relaxed">- {advice}</p>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── COMMUNITY INTELLIGENCE ─── */}
        <div className="hidden">
          {comments.length > 0 && (
            <motion.div {...fadeUp(0.5)} className="rounded-2xl border border-white/40 p-6" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)" }}>
              <h3 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-orange-500" /> Reddit Insights <span className="text-xs font-normal text-slate-400 ml-1">{reddit?.threads_analyzed} threads</span></h3>
              <div className="space-y-3">
                {comments.slice(0,4).map((c:any,i:number) => { const s = sentiment(c.comment); return (
                  <div key={i} className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-orange-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.color+"12", color: s.color }}>{s.label}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-400"><ArrowUp className="w-3 h-3" />{c.upvotes}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">&ldquo;{c.comment}&rdquo;</p>
                    {c.thread_url && <a href={c.thread_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-500 hover:underline mt-2 inline-block font-medium">View thread →</a>}
                  </div>
                ); })}
              </div>
            </motion.div>
          )}
          {transcripts.length > 0 && (
            <motion.div {...fadeUp(0.55)} className="rounded-2xl border border-white/40 p-6" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)" }}>
              <h3 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2"><Play className="w-4 h-4 text-red-500" /> YouTube Review Sources <span className="text-xs font-normal text-slate-400 ml-1">{youtubeEvidenceCount} {youtubeEvidenceLabel}</span></h3>
              <div className="space-y-3">
                {transcripts.slice(0,3).map((v:any,i:number) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-red-200 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-700 line-clamp-1 flex-1">{v.title}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0 bg-red-50 text-red-500">{v.evidence_type || "transcript"}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-2">{v.transcript_snippet?.slice(0,250)}...</p>
                    {v.rank_reasons?.length > 0 && (
                      <p className="text-[10px] text-slate-400 mb-2">{v.rank_reasons.slice(0, 3).join(" / ")}</p>
                    )}
                    {v.url && <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-red-500 hover:underline inline-flex items-center gap-1 font-medium"><Play className="w-3 h-3" /> Watch on YouTube →</a>}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ─── SENTIMENT ─── */}
        {comments.length > 0 && (() => {
          let pos=0,neg=0,neu=0;
          comments.forEach((c:any) => { const s = sentiment(c.comment); if(s.label==="Positive") pos++; else if(s.label==="Negative") neg++; else neu++; });
          const t=pos+neg+neu; const pP=Math.round(pos/t*100); const nP=Math.round(neg/t*100); const mP=100-pP-nP;
          return (
            <motion.div {...fadeUp(0.65)} className="premium-card rounded-2xl p-5 sm:p-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-5 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-300" /> Customer Sentiment Analysis</h3>
              <div className="space-y-4">
                {[{l:"Positive",p:pP,c:"#10b981",d:0.3},{l:"Neutral",p:mP,c:"#f59e0b",d:0.5},{l:"Negative",p:nP,c:"#ef4444",d:0.7}].map(b => (
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
