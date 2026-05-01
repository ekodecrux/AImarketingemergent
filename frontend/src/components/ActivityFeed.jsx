import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import {
    Pulse, ArrowRight, ShieldWarning, Sparkle, MegaphoneSimple, CheckCircle,
    Robot, PaperPlaneTilt, Plug,
} from "@phosphor-icons/react";

const ICON_FOR_KIND = {
    "content.blocked_safety": ShieldWarning,
    "ads.circuit_breaker": ShieldWarning,
    "content.published": PaperPlaneTilt,
    "content.scheduled": PaperPlaneTilt,
    "copilot.brief_sent": Robot,
    "copilot.recovery_action": Robot,
    "lead.captured": Sparkle,
    "lead.enriched": Sparkle,
    "ad.launched": MegaphoneSimple,
    "channel.connected": Plug,
    "channel.disconnected": Plug,
};

const COLOR_FOR_KIND = (kind) => {
    if (kind?.includes("blocked") || kind?.includes("circuit")) return "#DC2626";
    if (kind?.startsWith("content.published") || kind?.startsWith("lead.captured")) return "#10B981";
    if (kind?.startsWith("copilot")) return "#8B5CF6";
    if (kind?.startsWith("ad.")) return "#F59E0B";
    return "#2563EB";
};

function timeAgo(iso) {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
}

export default function ActivityFeed() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const r = await api.get("/activity/recent?limit=10");
            setItems(r.data.items || []);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 60000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="zm-card p-5" data-testid="activity-feed">
            <div className="flex items-center justify-between mb-3">
                <p className="zm-section-label flex items-center gap-1.5">
                    <Pulse size={11} weight="bold" /> // What just happened
                </p>
                <Link to="/audit" className="text-xs text-[#2563EB] hover:underline flex items-center gap-0.5" data-testid="activity-feed-all">
                    See all <ArrowRight size={10} weight="bold" />
                </Link>
            </div>

            {loading ? (
                <p className="text-xs text-[#A1A1AA]">Loading…</p>
            ) : items.length === 0 ? (
                <div className="text-center py-6">
                    <CheckCircle size={20} weight="duotone" className="mx-auto text-[#10B981]" />
                    <p className="text-xs text-[#71717A] mt-2">All quiet on the marketing front. Activity will appear here as ZeroMark works in the background.</p>
                </div>
            ) : (
                <ul className="space-y-2.5" data-testid="activity-feed-list">
                    {items.map((it) => {
                        const Icon = ICON_FOR_KIND[it.kind] || Pulse;
                        const color = COLOR_FOR_KIND(it.kind);
                        return (
                            <li key={it.id} className="flex items-start gap-2.5 text-xs" data-testid={`activity-item-${it.kind}`}>
                                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `${color}1A`, color }}>
                                    <Icon size={11} weight="bold" />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[#0F172A] truncate">{it.message}</p>
                                    <p className="text-[10px] text-[#94A3B8]">{timeAgo(it.created_at)}</p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
