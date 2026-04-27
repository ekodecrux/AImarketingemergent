import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Users, Megaphone, Clock, TrendUp, ArrowRight } from "@phosphor-icons/react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell,
} from "recharts";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import BriefingCard from "@/components/BriefingCard";

const STATUS_COLORS = ["#002EB8", "#10B981", "#F59E0B", "#E32636", "#18181B"];

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [briefing, setBriefing] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get("/dashboard/stats").then((r) => setData(r.data)),
            api.get("/briefing/latest").then((r) => setBriefing(r.data.briefing)),
        ]).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-12 text-sm text-[#71717A]">Loading…</div>;
    if (!data) return null;

    const stats = [
        { label: "Total Leads", value: data.stats.total_leads, icon: Users, sub: "All-time" },
        { label: "Campaigns", value: data.stats.total_campaigns, icon: Megaphone, sub: "Created" },
        { label: "Pending Approvals", value: data.stats.pending_approvals, icon: Clock, sub: "Action required", urgent: true },
        { label: "Conversion", value: `${data.stats.conversion_rate}%`, icon: TrendUp, sub: "Contacted → Converted" },
    ];

    return (
        <div>
            <PageHeader
                eyebrow="// Operations overview"
                title="Dashboard"
                subtitle={`${data.stats.subscription_tier} plan${data.stats.trial_days_left ? ` · ${data.stats.trial_days_left} trial days left` : ""}`}
            />
            <div className="px-8 pb-12">
                {/* AI Growth Briefing */}
                <div className="mb-6">
                    <BriefingCard initial={briefing} />
                </div>

                {/* Stat grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 zm-card mb-6" data-testid="dashboard-stats">
                    {stats.map((s, i) => (
                        <div
                            key={s.label}
                            className={`p-6 ${i < 3 ? "border-b lg:border-b-0 lg:border-r border-[#E4E4E7]" : ""} ${i < 2 ? "sm:border-b-0 sm:border-r" : ""}`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <s.icon size={20} weight="bold" className="text-[#71717A]" />
                                {s.urgent && s.value > 0 && (
                                    <span className="zm-badge bg-[#F59E0B] text-white">Action</span>
                                )}
                            </div>
                            <p className="zm-section-label mb-2">{s.label}</p>
                            <p className="font-display text-4xl font-black tracking-tighter" data-testid={`stat-${s.label.replace(/\s+/g, "-").toLowerCase()}`}>
                                {s.value}
                            </p>
                            <p className="text-xs text-[#A1A1AA] mt-1">{s.sub}</p>
                        </div>
                    ))}
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="zm-card p-6 lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="zm-section-label">// Leads inflow</p>
                                <h3 className="font-display text-2xl font-bold tracking-tight mt-1">Last 14 days</h3>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={data.charts.leads_over_time}>
                                <CartesianGrid stroke="#E4E4E7" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717A" }} stroke="#E4E4E7" />
                                <YAxis tick={{ fontSize: 11, fill: "#71717A" }} stroke="#E4E4E7" />
                                <Tooltip
                                    contentStyle={{
                                        background: "#09090B", border: "none", borderRadius: 0,
                                        fontSize: 12, color: "#fff",
                                    }}
                                    cursor={{ fill: "rgba(0,46,184,0.05)" }}
                                />
                                <Line type="monotone" dataKey="count" stroke="#002EB8" strokeWidth={2} dot={{ r: 3, fill: "#002EB8" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="zm-card p-6">
                        <p className="zm-section-label">// Lead distribution</p>
                        <h3 className="font-display text-2xl font-bold tracking-tight mt-1 mb-4">By status</h3>
                        {data.charts.leads_by_status.length === 0 ? (
                            <p className="text-sm text-[#A1A1AA] py-12 text-center">No data yet</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={data.charts.leads_by_status} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#71717A" }} width={90} stroke="#E4E4E7" />
                                    <Tooltip cursor={{ fill: "rgba(0,46,184,0.05)" }} contentStyle={{ background: "#09090B", border: "none", color: "#fff", fontSize: 12 }} />
                                    <Bar dataKey="value">
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
                                    <p className="text-xs text-[#71717A]">{l.email || l.phone || "—"}</p>
                                </div>
                                <span className="zm-badge bg-[#F4F4F5] text-[#09090B]">{l.status}</span>
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
                                    <p className="text-xs text-[#71717A]">{c.channel}</p>
                                </div>
                                <span className={`zm-badge ${
                                    c.status === "SENT" ? "bg-[#10B981] text-white" :
                                    c.status === "APPROVED" ? "bg-[#002EB8] text-white" :
                                    c.status === "REJECTED" ? "bg-[#E32636] text-white" :
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
            <div className="flex items-center justify-between p-6 border-b border-[#E4E4E7]">
                <div>
                    <p className="zm-section-label">// Activity</p>
                    <h3 className="font-display text-xl font-bold tracking-tight mt-1">{title}</h3>
                </div>
                <Link to={link} className="text-xs uppercase tracking-[0.15em] font-bold text-[#002EB8] hover:underline flex items-center gap-1">
                    View all <ArrowRight size={12} weight="bold" />
                </Link>
            </div>
            <div>
                {items.length === 0 ? (
                    <p className="text-sm text-[#A1A1AA] py-12 text-center">Nothing yet</p>
                ) : items.map((it, i) => (
                    <div key={it.id || i} className="flex items-center justify-between px-6 py-4 border-b border-[#E4E4E7] last:border-b-0">
                        {renderItem(it)}
                    </div>
                ))}
            </div>
        </div>
    );
}
