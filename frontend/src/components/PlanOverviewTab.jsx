import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
    ArrowsClockwise, Sparkle, ArrowRight, CheckCircle, Target, ChartLineUp,
    MagnifyingGlass, Newspaper, Calendar, Lightning, Briefcase, Clock,
} from "@phosphor-icons/react";

const ICON_BY_MODULE = {
    quick_plan: Lightning,
    icp: Target,
    market: ChartLineUp,
    seo: MagnifyingGlass,
    content_ideas: Briefcase,
    pr: Newspaper,
    growth_plan: Calendar,
};

function timeAgo(iso) {
    if (!iso) return "never";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
}

export default function PlanOverviewTab({ onOpenTab }) {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [pollTimer, setPollTimer] = useState(null);

    const load = useCallback(async () => {
        try {
            const r = await api.get("/plan/summary");
            setData(r.data);
            return r.data;
        } catch (e) {
            toast.error(e.response?.data?.detail || "Failed to load plan summary");
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Poll every 5s while regenerating in background — stop once all modules caught up
    useEffect(() => {
        return () => { if (pollTimer) clearInterval(pollTimer); };
    }, [pollTimer]);

    const startPolling = () => {
        if (pollTimer) clearInterval(pollTimer);
        let ticks = 0;
        const t = setInterval(async () => {
            ticks++;
            const d = await load();
            // stop after 2min or when all ready
            if (ticks > 24 || (d && d.modules_ready >= d.modules_total - 1)) {
                clearInterval(t);
                setPollTimer(null);
                setRegenerating(false);
            }
        }, 5000);
        setPollTimer(t);
    };

    const regenerateAll = async () => {
        setRegenerating(true);
        const t = toast.loading("Regenerating all plan modules in parallel…");
        try {
            await api.post("/plan/regenerate-all");
            toast.success("Plan regenerated across all modules", { id: t });
            await load();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Regeneration failed", { id: t });
        } finally {
            setRegenerating(false);
        }
    };

    // If backend indicated background regen via business-save, begin polling automatically
    useEffect(() => {
        const flag = sessionStorage.getItem("plan_bg_regen");
        if (flag === "1") {
            sessionStorage.removeItem("plan_bg_regen");
            setRegenerating(true);
            startPolling();
        }
        // eslint-disable-next-line
    }, []);

    if (loading) {
        return <div className="zm-card p-8 text-center text-[#71717A]" data-testid="plan-overview-loading">Loading plan summary…</div>;
    }

    if (!data?.profile_set) {
        return (
            <div className="zm-card p-10 text-center" data-testid="plan-overview-no-profile">
                <Briefcase size={32} weight="bold" className="mx-auto text-[#2563EB]" />
                <h2 className="font-display text-2xl font-black tracking-tighter mt-3">Tell us about your business first</h2>
                <p className="text-sm text-[#71717A] mt-2 max-w-md mx-auto">
                    The plan overview shows ICP, market, SEO, PR and a 12-month roadmap — all auto-generated from your business profile.
                </p>
                <button onClick={() => navigate("/business")} className="zm-btn-primary mt-5" data-testid="plan-overview-go-business">
                    Fill business profile <ArrowRight size={14} weight="bold" />
                </button>
            </div>
        );
    }

    const readyPct = Math.round((data.modules_ready / data.modules_total) * 100);

    return (
        <div className="space-y-6" data-testid="plan-overview">
            {/* Hero / sync status */}
            <div className="zm-card p-6 bg-[#0F172A] text-white" data-testid="plan-overview-hero">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold">// Plan Overview · {data.business_name}</p>
                        <h2 className="font-display text-3xl font-black tracking-tighter mt-1">
                            One plan, everywhere.
                        </h2>
                        <p className="text-sm text-white/70 mt-1 max-w-xl">
                            Everything AI knows about your growth — synced from your business profile. Click any card to dive deeper, or regenerate all in one click.
                        </p>
                        <div className="flex items-center gap-3 mt-4 text-xs text-white/60">
                            <Clock size={12} weight="bold" />
                            <span>Last regenerated: <strong className="text-white">{timeAgo(data.last_regenerated_at)}</strong></span>
                            <span className="opacity-40">·</span>
                            <span>{data.modules_ready}/{data.modules_total} modules ready ({readyPct}%)</span>
                        </div>
                    </div>
                    <button
                        onClick={regenerateAll}
                        disabled={regenerating}
                        className="zm-btn bg-white text-[#0F172A] hover:bg-[#F8FAFC] shrink-0"
                        data-testid="plan-overview-regenerate-all"
                    >
                        <ArrowsClockwise size={14} weight="bold" className={regenerating ? "animate-spin" : ""} />
                        {regenerating ? "Regenerating…" : "Regenerate all"}
                    </button>
                </div>
                {/* Progress bar */}
                <div className="mt-4 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#10B981] transition-all duration-500" style={{ width: `${readyPct}%` }} />
                </div>
            </div>

            {/* Cards grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="plan-overview-cards">
                {data.cards.map((c) => {
                    const Icon = ICON_BY_MODULE[c.module] || Sparkle;
                    return (
                        <button
                            key={c.module}
                            onClick={() => onOpenTab && onOpenTab(c.tab)}
                            className="zm-card p-5 text-left hover:border-[#2563EB] hover:shadow-md transition-all group"
                            data-testid={`plan-card-${c.module}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className={`p-2 rounded-sm ${c.has_data ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F8FAFC] text-[#71717A]"}`}>
                                    <Icon size={18} weight="bold" />
                                </div>
                                {c.has_data ? (
                                    <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#10B981] flex items-center gap-1">
                                        <CheckCircle size={12} weight="fill" /> Ready
                                    </span>
                                ) : (
                                    <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-[#F59E0B]">
                                        Not generated
                                    </span>
                                )}
                            </div>
                            <h3 className="font-display text-lg font-bold tracking-tight text-[#0F172A] mt-3">{c.title}</h3>
                            <p className="text-sm text-[#71717A] mt-1 line-clamp-3">{c.summary}</p>
                            {c.highlights?.length > 0 && (
                                <ul className="mt-3 space-y-1">
                                    {c.highlights.slice(0, 3).map((h, i) => (
                                        <li key={i} className="text-xs text-[#0F172A] flex items-start gap-1.5 line-clamp-1">
                                            <span className="text-[#2563EB] shrink-0">›</span> {h}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="mt-4 flex items-center justify-between text-[11px] text-[#71717A]">
                                <span>{c.has_data ? `Updated ${timeAgo(c.generated_at)}` : "Click to generate"}</span>
                                <span className="flex items-center gap-1 text-[#2563EB] font-bold opacity-0 group-hover:opacity-100 transition">
                                    Open <ArrowRight size={12} weight="bold" />
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <p className="text-xs text-[#71717A] text-center" data-testid="plan-overview-hint">
                <Sparkle size={12} weight="fill" className="inline text-[#F59E0B]" /> Update your Business Profile → we auto-regenerate every module in the background. You never have to click "Generate" per tab again.
            </p>
        </div>
    );
}
