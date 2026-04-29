import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, Buildings, Megaphone, Article, Globe, ChartLineUp, TrendUp } from "@phosphor-icons/react";

export default function AdminOverview() {
    const [overview, setOverview] = useState(null);
    const [revenue, setRevenue] = useState(null);

    useEffect(() => {
        api.get("/admin/overview").then((r) => setOverview(r.data));
        api.get("/admin/revenue").then((r) => setRevenue(r.data));
    }, []);

    if (!overview) return <div className="p-12 text-sm text-[#64748B]">Loading…</div>;

    const t = overview.totals;
    const stats = [
        { label: "Total users", value: t.users, icon: Users },
        { label: "Workspaces", value: t.workspaces, icon: Buildings },
        { label: "Total leads", value: t.leads.toLocaleString(), icon: ChartLineUp },
        { label: "Campaigns", value: t.campaigns, icon: Megaphone },
        { label: "Content kits", value: t.content_kits, icon: Article },
        { label: "Landing pages", value: t.landing_pages, icon: Globe },
    ];

    return (
        <div className="px-6 py-6 space-y-6" data-testid="admin-overview-page">
            <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#F59E0B] font-bold">// Platform owner console</p>
                <h1 className="font-display text-3xl font-black tracking-tight mt-1">Platform Overview</h1>
                <p className="text-sm text-[#64748B] mt-1">SaaS-wide statistics. Refreshed live.</p>
            </div>

            {/* Revenue summary card — TOP */}
            {revenue && (
                <div className="zm-card bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white border-0 p-7 sm:p-9" data-testid="admin-revenue-summary">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-[#F59E0B] font-bold mb-2">// Recurring revenue</p>
                    <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
                        <div>
                            <p className="font-display text-5xl sm:text-6xl font-black tracking-tighter text-[#10B981]">
                                ₹{revenue.mrr_inr.toLocaleString()}
                            </p>
                            <p className="text-xs text-white/60 font-semibold mt-1">MRR · monthly recurring</p>
                        </div>
                        <div>
                            <p className="font-display text-3xl font-black tracking-tighter">₹{(revenue.arr_inr || 0).toLocaleString()}</p>
                            <p className="text-xs text-white/60 font-semibold mt-1">ARR · annualised</p>
                        </div>
                        <div>
                            <p className="font-display text-2xl font-black tracking-tighter text-[#2563EB]">₹{(revenue.revenue_30d_inr || 0).toLocaleString()}</p>
                            <p className="text-xs text-white/60 font-semibold mt-1">last 30 days · paid plans</p>
                        </div>
                        <div>
                            <p className="font-display text-2xl font-black tracking-tighter text-[#F59E0B]">₹{(revenue.wallet_topups_30d_inr || 0).toLocaleString()}</p>
                            <p className="text-xs text-white/60 font-semibold mt-1">last 30 days · wallet top-ups</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="admin-stats-grid">
                {stats.map((s) => (
                    <div key={s.label} className="zm-card p-5">
                        <s.icon size={18} weight="bold" className="text-[#2563EB]" />
                        <p className="font-display text-3xl font-black tracking-tight mt-2">{s.value}</p>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-[#64748B] font-bold mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="zm-card p-6">
                    <p className="zm-section-label mb-3">// Growth · last 7 days</p>
                    <div className="flex gap-8">
                        <div>
                            <p className="font-display text-4xl font-black tracking-tight text-[#2563EB]">{overview.growth.new_users_7d}</p>
                            <p className="text-xs text-[#64748B] font-semibold mt-1">New signups</p>
                        </div>
                        <div>
                            <p className="font-display text-4xl font-black tracking-tight text-[#10B981]">{overview.growth.active_7d}</p>
                            <p className="text-xs text-[#64748B] font-semibold mt-1 flex items-center gap-1">
                                <TrendUp size={11} weight="bold" /> Active users
                            </p>
                        </div>
                    </div>
                </div>
                <div className="zm-card p-6">
                    <p className="zm-section-label mb-3">// Auth provider mix</p>
                    <div className="flex flex-wrap gap-2">
                        {overview.by_provider.map((p) => (
                            <span key={p.provider} className="zm-badge bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] px-3 py-1.5">
                                {p.provider}: <strong className="ml-1">{p.count}</strong>
                            </span>
                        ))}
                    </div>
                    <p className="zm-section-label mt-5 mb-3">// Subscription mix</p>
                    <div className="flex flex-wrap gap-2">
                        {overview.by_plan.map((p) => (
                            <span key={p.plan} className="zm-badge bg-[#DBEAFE] text-[#1D4ED8] px-3 py-1.5">
                                {p.plan}: <strong className="ml-1">{p.count}</strong>
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
