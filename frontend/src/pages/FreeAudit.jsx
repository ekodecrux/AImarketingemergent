import { useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
    Sparkle, ArrowRight, ArrowsClockwise, CheckCircle, X, Lightning, MagnifyingGlass,
    Target, ChartLineUp, Lightbulb,
} from "@phosphor-icons/react";

export default function FreeAudit() {
    const [url, setUrl] = useState("");
    const [email, setEmail] = useState("");
    const [biz, setBiz] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        if (!url || !email) { toast.error("URL and email required"); return; }
        setLoading(true);
        try {
            const r = await api.post("/free-audit", { url, email, business_name: biz });
            setResult(r.data);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            toast.error(err.response?.data?.detail || "Audit failed");
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-white" data-testid="free-audit-page">
            {/* Top bar */}
            <header className="border-b border-[#E2E8F0] bg-white sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-md bg-[#0F172A] flex items-center justify-center">
                            <Sparkle size={18} weight="fill" className="text-[#2563EB]" />
                        </div>
                        <span className="font-display text-lg font-black tracking-tight">ZeroMark</span>
                    </Link>
                    <Link to="/login" className="text-sm font-bold text-[#475569] hover:text-[#0F172A]">Sign in</Link>
                </div>
            </header>

            {!result ? (
                <div className="max-w-3xl mx-auto px-6 py-12 lg:py-20">
                    <span className="zm-tag-pill mb-4 bg-[#10B981]/10 text-[#065F46]">// 100% free · no card · 30 sec</span>
                    <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] mt-4">
                        Get a <span className="text-[#10B981]">free AI audit</span> of your website + 3 organic content ideas tailored to your business.
                    </h1>
                    <p className="text-base text-[#475569] mt-5 max-w-xl leading-relaxed">
                        Paste your URL. We'll instantly score your SEO, find missing tags, and hand you 3 content ideas that ZeroMark's AI thinks will rank fastest for you. Same engine that powers our paid platform.
                    </p>

                    <form onSubmit={submit} className="mt-8 zm-card p-6 sm:p-8 space-y-4 border-l-2 border-l-[#10B981]" data-testid="audit-form">
                        <div>
                            <label className="zm-label">Your website URL</label>
                            <input value={url} onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://yourbusiness.com" type="url"
                                className="zm-input text-base" data-testid="audit-url-input" required />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="zm-label">Email <span className="text-[#94A3B8] font-normal">(report sent here)</span></label>
                                <input value={email} onChange={(e) => setEmail(e.target.value)}
                                    type="email" placeholder="you@business.com"
                                    className="zm-input" data-testid="audit-email-input" required />
                            </div>
                            <div>
                                <label className="zm-label">Business name <span className="text-[#94A3B8] font-normal">(optional)</span></label>
                                <input value={biz} onChange={(e) => setBiz(e.target.value)}
                                    className="zm-input" data-testid="audit-biz-input" />
                            </div>
                        </div>
                        <button disabled={loading} className="zm-btn-primary text-base w-full sm:w-auto" data-testid="audit-submit">
                            {loading ? <ArrowsClockwise size={16} weight="bold" className="animate-spin" /> : <Sparkle size={16} weight="fill" />}
                            {loading ? "Auditing your site…" : "Get my free audit"} <ArrowRight size={16} weight="bold" />
                        </button>
                        <p className="text-[11px] text-[#64748B]">
                            <CheckCircle size={11} weight="fill" className="inline text-[#10B981] mr-1" />
                            No spam · We won't share your email · Unsubscribe anytime
                        </p>
                    </form>

                    <div className="grid sm:grid-cols-3 gap-4 mt-12">
                        {[
                            { icon: MagnifyingGlass, t: "SEO heuristics", d: "Title, meta, H1, og-image, canonical, alt-text coverage." },
                            { icon: Lightbulb, t: "3 content ideas", d: "AI suggests 3 organic posts that match your audience + best format." },
                            { icon: Target, t: "Organic-first tip", d: "The single biggest opportunity to rank without spending on ads." },
                        ].map((b) => (
                            <div key={b.t} className="zm-card p-5">
                                <b.icon size={20} weight="bold" className="text-[#10B981]" />
                                <p className="font-display text-base font-bold mt-2">{b.t}</p>
                                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{b.d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <AuditResult data={result} onReset={() => { setResult(null); setUrl(""); }} />
            )}
        </div>
    );
}


function AuditResult({ data, onReset }) {
    const score = data.score;
    const scoreColor = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
    const scoreLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good — fixable wins" : "Needs work";
    const ai = data.ai || {};
    const scrape = data.scrape || {};

    return (
        <div className="max-w-5xl mx-auto px-6 py-10 lg:py-14" data-testid="audit-result">
            <button onClick={onReset} className="text-sm font-bold text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 mb-5">
                <X size={14} weight="bold" /> New audit
            </button>

            <div className="zm-card bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white border-0 p-8 sm:p-10">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-bold mb-2">// SEO score</p>
                <div className="flex items-baseline gap-6 flex-wrap">
                    <p className="font-display text-7xl sm:text-8xl font-black tracking-tighter" style={{ color: scoreColor }} data-testid="audit-score">
                        {score}
                        <span className="text-2xl font-bold text-white/40 ml-1">/100</span>
                    </p>
                    <div>
                        <p className="font-display text-2xl font-bold tracking-tight">{scoreLabel}</p>
                        <p className="text-xs text-white/60 truncate max-w-xs mt-1">{scrape.final_url || data.url}</p>
                    </div>
                </div>
                {(data.issues || []).length > 0 && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-bold mb-3">// {data.issues.length} fixable issues</p>
                        <ul className="space-y-1.5">
                            {data.issues.map((s, i) => (
                                <li key={i} className="text-sm text-white/85 flex items-start gap-2">
                                    <span className="text-[#F59E0B] font-black mt-0.5">→</span> {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {ai.business_summary && (
                <div className="zm-card p-6 mt-6">
                    <p className="zm-section-label">// Your business</p>
                    <p className="text-base text-[#0F172A] mt-1 leading-relaxed">{ai.business_summary}</p>
                    {ai.primary_audience && (
                        <p className="text-sm text-[#64748B] mt-2"><strong>Audience:</strong> {ai.primary_audience}</p>
                    )}
                    {(ai.top_strengths || []).length > 0 && (
                        <div className="mt-4">
                            <p className="zm-section-label mb-2">// What's working</p>
                            <div className="flex flex-wrap gap-2">
                                {ai.top_strengths.map((s, i) => (
                                    <span key={i} className="zm-badge bg-[#D1FAE5] text-[#065F46]">+ {s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {(ai.content_ideas || []).length > 0 && (
                <div className="mt-6">
                    <p className="zm-section-label">// 3 organic content ideas tailored to your site</p>
                    <div className="grid md:grid-cols-3 gap-4 mt-3">
                        {ai.content_ideas.map((c, i) => (
                            <div key={i} className="zm-card p-5 border-l-2 border-l-[#10B981]" data-testid={`audit-idea-${i}`}>
                                <span className="zm-badge bg-[#10B981]/15 text-[#065F46] mb-2">{c.format}</span>
                                <h3 className="font-display text-base font-bold tracking-tight">{c.title}</h3>
                                <p className="text-xs text-[#64748B] mt-2 leading-relaxed">{c.why}</p>
                                {c.target_keyword && <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#94A3B8] mt-3">target keyword · {c.target_keyword}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {ai.organic_growth_tip && (
                <div className="zm-card p-6 mt-6 bg-[#10B981]/5 border-l-2 border-l-[#10B981]">
                    <p className="zm-section-label">// Biggest organic-first opportunity</p>
                    <p className="font-display text-lg font-bold tracking-tight mt-1">{ai.organic_growth_tip}</p>
                </div>
            )}

            {/* Convert to platform */}
            <div className="zm-card bg-[#0F172A] text-white border-0 p-7 mt-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 className="font-display text-xl font-black tracking-tight">Want ZeroMark to publish these for you?</h3>
                    <p className="text-sm text-white/70 mt-1">14 days free · no card · we'll auto-write & schedule the 3 ideas above.</p>
                </div>
                <Link to="/register" className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-sm px-5 py-3 rounded-xl inline-flex items-center gap-2 whitespace-nowrap" data-testid="audit-convert-cta">
                    <Lightning size={14} weight="fill" /> Start 14-day trial <ArrowRight size={14} weight="bold" />
                </Link>
            </div>
        </div>
    );
}
