import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import {
    LinkedinLogo, TwitterLogo, FacebookLogo, InstagramLogo, MegaphoneSimple,
    CheckCircle, WarningCircle, XCircle, Crown, ArrowRight, ArrowsClockwise, Plugs,
} from "@phosphor-icons/react";

const CHANNELS = [
    { id: "linkedin", label: "LinkedIn", icon: LinkedinLogo, brand: "#0A66C2" },
    { id: "twitter", label: "X", icon: TwitterLogo, brand: "#0F172A" },
    { id: "facebook", label: "Facebook", icon: FacebookLogo, brand: "#1877F2" },
    { id: "instagram", label: "Instagram", icon: InstagramLogo, brand: "#E4405F" },
    { id: "meta_ads", label: "Meta Ads", icon: MegaphoneSimple, brand: "#000" },
];

function dotFor(s) {
    if (s?.healthy) return { color: "#10B981", icon: CheckCircle, label: "Live" };
    if (s?.connected) return { color: "#F59E0B", icon: WarningCircle, label: s.status_label || "Stale" };
    if (s && s.provider_configured === false) return { color: "#A1A1AA", icon: Crown, label: "Awaiting platform" };
    return { color: "#E2E8F0", icon: XCircle, label: "Off" };
}

export default function ChannelHealthWidget() {
    const [health, setHealth] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        try {
            const r = await api.get("/integrations/health");
            setHealth(r.data.channels || {});
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 60000); // 60s auto-refresh
        return () => clearInterval(t);
    }, []);

    const refresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const liveCount = CHANNELS.filter((c) => health[c.id]?.healthy).length;
    const staleCount = CHANNELS.filter((c) => health[c.id]?.connected && !health[c.id]?.healthy).length;
    const needsAttention = staleCount > 0;

    return (
        <div className={`zm-card p-5 ${needsAttention ? "border-l-4 border-[#F59E0B]" : ""}`} data-testid="channel-health-widget">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <p className="zm-section-label flex items-center gap-1.5">
                        <Plugs size={11} weight="bold" /> // Channel health
                    </p>
                    <h3 className="font-display text-lg font-bold tracking-tight mt-1">
                        {loading ? "…" : `${liveCount}/${CHANNELS.length} channels live`}
                        {needsAttention && (
                            <span className="ml-2 text-xs font-bold text-[#F59E0B] uppercase tracking-[0.15em]">
                                · {staleCount} need attention
                            </span>
                        )}
                    </h3>
                </div>
                <button
                    onClick={refresh}
                    disabled={refreshing}
                    className="text-xs text-[#64748B] hover:text-[#0F172A] flex items-center gap-1 shrink-0"
                    data-testid="channel-health-refresh"
                    title="Refresh health"
                >
                    <ArrowsClockwise size={12} weight="bold" className={refreshing ? "animate-spin" : ""} />
                </button>
            </div>

            <div className="grid grid-cols-5 gap-2" data-testid="channel-health-grid">
                {CHANNELS.map((c) => {
                    const s = health[c.id] || {};
                    const dot = dotFor(s);
                    return (
                        <div key={c.id} className="text-center" data-testid={`channel-dot-${c.id}`} title={`${c.label} · ${dot.label}`}>
                            <div
                                className="w-9 h-9 mx-auto rounded-full flex items-center justify-center relative"
                                style={{ background: dot.color }}
                            >
                                <c.icon size={14} weight="fill" className="text-white" />
                                <span
                                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                                    style={{ background: dot.color }}
                                />
                            </div>
                            <p className="text-[10px] font-bold text-[#0F172A] mt-1.5 uppercase tracking-wide truncate">{c.label}</p>
                            <p className="text-[9px] text-[#94A3B8] truncate">{dot.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Stale-channel callouts with reconnect CTA */}
            {needsAttention && (
                <div className="mt-4 pt-3 border-t border-[#E2E8F0] space-y-1.5">
                    {CHANNELS.filter((c) => health[c.id]?.connected && !health[c.id]?.healthy).map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-xs" data-testid={`stale-${c.id}`}>
                            <span className="text-[#0F172A]">
                                <c.icon size={12} weight="fill" className="inline mr-1.5" style={{ color: c.brand }} />
                                <span className="font-bold">{c.label}:</span>{" "}
                                <span className="text-[#71717A]">{health[c.id]?.message || "needs reconnect"}</span>
                            </span>
                            <Link
                                to="/connect"
                                className="text-[#2563EB] font-bold hover:underline shrink-0 ml-2 flex items-center gap-0.5"
                                data-testid={`reconnect-${c.id}`}
                            >
                                Reconnect <ArrowRight size={10} weight="bold" />
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            <Link
                to="/connect"
                className="mt-3 text-xs text-[#2563EB] font-bold hover:underline inline-flex items-center gap-1"
                data-testid="channel-health-manage"
            >
                Manage all channels <ArrowRight size={10} weight="bold" />
            </Link>
        </div>
    );
}
