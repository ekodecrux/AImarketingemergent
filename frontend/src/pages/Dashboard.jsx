import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, Megaphone, Clock, TrendUp, ArrowRight, CheckCircle, Sparkle } from "@phosphor-icons/react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell,
} from "recharts";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import BriefingCard from "@/components/BriefingCard";
import SetupChecklist from "@/components/SetupChecklist";
import { setLocaleCache } from "@/lib/locale";

const STATUS_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#0F172A", "#A855F7"];

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [briefing, setBriefing] = useState(null);
    const [setup, setSetup] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        Promise.all([
            api.get("/dashboard/stats").then((r) => setData(r.data)),
            api.get("/briefing/latest").then((r) => setBriefing(r.data.briefing)).catch(() => {}),
            api.get("/setup/status").then((r) => {
                setSetup(r.data);
                if (r.data.locale) setLocaleCache(r.data.locale);
                // If business profile not set, force to onboarding
                if (!r.data.has_profile) navigate("/onboarding");
            }).catch(() => {}),
        ]).finally(() => setLoading(false));
    }, [navigate]);

    if (loading) return <div className="p-12 text-sm text-[#64748B]">Loading…</div>;
    if (!data) return null;

    const stats = [
        { label: "Total Leads", value: data.stats.total_leads, icon: Users, sub: "All-time" },
        { label: "Campaigns", value: data.stats.total_campaigns, icon: Megaphone, sub: "Created" },
        { label: "Pending Approvals", value: data.stats.pending_approvals, icon: Clock, sub: "Action required", urgent: true },
        { label: "Conversion", value: `${data.stats.conversion_rate}%`, icon: TrendUp, sub: "Contacted → Converted" },
    ];

    const setupIncomplete = setup && setup.completed < setup.total;

    return (
        <div>
            <PageHeader
                eyebrow="// Operations overview"
                title="Dashboard"
                subtitle={`${data.stats.subscription_tier} plan${data.stats.trial_days_left ? ` · ${data.stats.trial_days_left} trial days left` : ""}`}
            />
            <div className="px-4 sm:px-6 lg:px-8 pb-12">
                {/* Setup checklist — shows until everything is done */}
                {setupIncomplete && <SetupChecklist setup={setup} />}

                {/* Daily AI Briefing */}
                {briefing && !setupIncomplete && (
                    <div className="mb-6">
                        <BriefingCard initial={briefing} />
                    </div>
                )}

                {/* Stat grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="dashboard-stats">
                    {stats.map((s) => (
                        <div key={s.label} className="zm-card p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-9 h-9 rounded-md bg-[#F8FAFC] flex items-center justify-center">
                                    <s.icon size={16} weight="bold" className="text-[#64748B]" />
                                </div>
                                {s.urgent && s.value > 0 && (
                                    <span className="zm-badge bg-[#F59E0B] text-white">Action</span>
                                )}
                            </div>
                            <p className="zm-section-label mb-1">{s.label}</p>
                            <p className="font-display text-3xl font-black tracking-tight" data-testid={`stat-${s.label.replace(/\s+/g, "-").toLowerCase()}`}>
                                {s.value}
                            </p>
                            <p className="text-xs text-[#94A3B8] mt-1">{s.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="zm-card p-6 lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="zm-section-label">// Leads inflow</p>
                                <h3 className="font-display text-xl font-bold tracking-tight mt-1">Last 14 days</h3>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={data.charts.leads_over_time}>
                                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} stroke="#E2E8F0" />
                                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} stroke="#E2E8F0" />
                                <Tooltip
                                    contentStyle={{ background: "#0F172A", border: "none", borderRadius: 8, fontSize: 12, color: "#fff" }}
                                    cursor={{ fill: "rgba(37,99,235,0.05)" }}
                                />
                                <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3, fill: "#2563EB" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="zm-card p-6">
                        <p className="zm-section-label">// Lead distribution</p>
                        <h3 className="font-display text-xl font-bold tracking-tight mt-1 mb-4">By status</h3>
                        {data.charts.leads_by_status.length === 0 ? (
                            <p className="text-sm text-[#94A3B8] py-12 text-center">No data yet</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={data.charts.leads_by_status} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} width={90} stroke="#E2E8F0" />
                                    <Tooltip cursor={{ fill: "rgba(37,99,235,0.05)" }} contentStyle={{ background: "#0F172A", border: "none", borderRadius: 8, color: "#fff", fontSize: 12 }} />
                                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                                        {data.charts.leads_by_status.map((_, i) => (
                                            <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Recent activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <RecentList
                        title="Recent leads"
                        link="/leads"
                        items={data.recent.leads}
                        renderItem={(l) => (
                            <>
                                <div>
                                    <p className="text-sm font-semibold">{l.name}</p>
                                    <p className="text-xs text-[#64748B]">{l.email || l.phone || "—"}</p>
                                </div>
                                <span className="zm-badge bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0]">{l.status}</span>
                            </>
                        )}
                    />
                    <RecentList
                        title="Recent campaigns"
                        link="/campaigns"
                        items={data.recent.campaigns}
                        renderItem={(c) => (
                            <>
                                <div>
                                    <p className="text-sm font-semibold">{c.name}</p>
                                    <p className="text-xs text-[#64748B]">{c.channel}</p>
                                </div>
                                <span className={`zm-badge ${
                                    c.status === "SENT" ? "bg-[#10B981] text-white" :
                                    c.status === "APPROVED" ? "bg-[#2563EB] text-white" :
                                    c.status === "REJECTED" ? "bg-[#DC2626] text-white" :
                                    "bg-[#F59E0B] text-white"
                                }`}>{c.status}</span>
                            </>
                        )}
                    />
                </div>
            </div>
        </div>
    );
}

function RecentList({ title, link, items, renderItem }) {
    return (
        <div className="zm-card">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
                <div>
                    <p className="zm-section-label">// Activity</p>
                    <h3 className="font-display text-lg font-bold tracking-tight mt-1">{title}</h3>
                </div>
                <Link to={link} className="text-xs uppercase tracking-[0.1em] font-bold text-[#2563EB] hover:underline flex items-center gap-1">
                    View all <ArrowRight size={12} weight="bold" />
                </Link>
            </div>
            <div>
                {items.length === 0 ? (
                    <p className="text-sm text-[#94A3B8] py-12 text-center">Nothing yet</p>
                ) : items.map((it, i) => (
                    <div key={it.id || i} className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0] last:border-b-0">
                        {renderItem(it)}
                    </div>
                ))}
            </div>
        </div>
    );
}
