import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    ChartBar, Lightning, GpsFix, Eye, CursorClick, UserCheck, RocketLaunch,
    LinkedinLogo, TwitterLogo, InstagramLogo, FileText, EnvelopeSimple,
} from "@phosphor-icons/react";
import {
    AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from "recharts";

const REPORT_TYPES = [
    { v: "LEAD_PERFORMANCE", label: "Lead Performance", icon: ChartBar, desc: "Sources, statuses, throughput." },
    { v: "CAMPAIGN_PERFORMANCE", label: "Campaign Performance", icon: Lightning, desc: "Sent, failed, by channel." },
    { v: "GAP_ANALYSIS", label: "Gap Analysis", icon: GpsFix, desc: "Distance to monthly targets + AI suggestions." },
];

const PLATFORM_META = {
    linkedin: { label: "LinkedIn", icon: LinkedinLogo, color: "#0A66C2" },
    twitter: { label: "X (Twitter)", icon: TwitterLogo, color: "#0F172A" },
    instagram: { label: "Instagram", icon: InstagramLogo, color: "#E4405F" },
    blog: { label: "Blog (SEO)", icon: FileText, color: "#10B981" },
    email_broadcast: { label: "Email broadcast", icon: EnvelopeSimple, color: "#F59E0B" },
};

export default function Reports() {
    const [reports, setReports] = useState([]);
    const [periodDays, setPeriodDays] = useState(30);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(null);
    const [metrics, setMetrics] = useState(null);
    const [metricsLoading, setMetricsLoading] = useState(true);

    const load = () => {
        api.get("/reports").then((r) => setReports(r.data.reports));
    };

    const loadMetrics = (days) => {
        setMetricsLoading(true);
        api.get(`/reports/marketing-metrics?days=${days}`)
            .then((r) => setMetrics(r.data))
            .catch(() => setMetrics(null))
            .finally(() => setMetricsLoading(false));
    };

    useEffect(() => { load(); }, []);
    useEffect(() => { loadMetrics(periodDays); }, [periodDays]);

    const generate = async (type) => {
        setLoading(true);
        try {
            const r = await api.post("/reports/generate", { type, period_days: periodDays });
            toast.success("Report generated");
            setActive(r.data.report);
            load();
        } catch {
            toast.error("Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div data-testid="reports-page">
            <PageHeader eyebrow="// Insights" title="Reports & Analysis" subtitle="Traffic, impressions, clicks, conversions — driven by your scheduled content." />
            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
                {/* Period selector — global */}
                <div className="flex flex-wrap items-center gap-3">
                    <span className="zm-section-label">Period</span>
                    <select
                        value={periodDays}
                        onChange={(e) => setPeriodDays(Number(e.target.value))}
                        className="zm-input w-auto"
                        data-testid="report-period"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    {metrics?.is_synthetic && (
                        <span className="text-[11px] text-[#94A3B8] italic ml-1" data-testid="metrics-synthetic-note">
                            Estimated · connect real OAuth in Integrations for live data
                        </span>
                    )}
                </div>

                {/* Marketing metrics — top of page (P1 requested) */}
                <MarketingMetricsPanel metrics={metrics} loading={metricsLoading} />

                {/* Generate report cards */}
                <div>
                    <h2 className="font-display text-xl font-bold tracking-tight mb-4">On-demand reports</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-0 zm-card" data-testid="report-types">
                        {REPORT_TYPES.map((t, i) => (
                            <div key={t.v} className={`p-6 ${i < 2 ? "md:border-r border-b md:border-b-0" : ""} border-[#E2E8F0]`}>
                                <t.icon size={24} weight="bold" className="mb-3" />
                                <h3 className="font-display text-lg font-bold tracking-tight">{t.label}</h3>
                                <p className="text-xs text-[#71717A] mt-1 mb-4">{t.desc}</p>
                                <button disabled={loading} onClick={() => generate(t.v)} className="zm-btn-primary w-full" data-testid={`generate-${t.v}`}>
                                    {loading ? "Generating…" : "Generate"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {active && (
                    <div className="zm-card p-6" data-testid="report-active">
                        <p className="zm-section-label">// Latest report</p>
                        <h3 className="font-display text-2xl font-bold tracking-tight mt-1 mb-4">{active.type.replace(/_/g, " ")}</h3>
                        <pre className="bg-[#F8FAFC] border-l-2 border-[#2563EB] p-4 text-xs overflow-x-auto font-mono">{JSON.stringify(active.data, null, 2)}</pre>
                    </div>
                )}

                <div>
                    <h2 className="font-display text-xl font-bold tracking-tight mb-4">History</h2>
                    <div className="zm-card overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E2E8F0]">
                                    <th className="text-left px-4 py-3 zm-section-label">Type</th>
                                    <th className="text-left px-4 py-3 zm-section-label">Period</th>
                                    <th className="text-left px-4 py-3 zm-section-label">Generated</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-12 text-center text-[#A1A1AA]">No reports generated</td></tr>
                                )}
                                {reports.map((r) => (
                                    <tr key={r.id} className="border-b border-[#E2E8F0] last:border-b-0">
                                        <td className="px-4 py-3 font-semibold">{r.type.replace(/_/g, " ")}</td>
                                        <td className="px-4 py-3 text-[#71717A]">
                                            {new Date(r.period_start).toLocaleDateString()} → {new Date(r.period_end).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3 text-[#71717A]">{new Date(r.generated_at).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => setActive(r)} className="text-[#2563EB] text-xs uppercase tracking-[0.15em] font-bold hover:underline">View</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}


function MarketingMetricsPanel({ metrics, loading }) {
    if (loading && !metrics) {
        return (
            <div className="zm-card p-12 text-center text-sm text-[#94A3B8]" data-testid="metrics-loading">
                Loading metrics…
            </div>
        );
    }
    if (!metrics) return null;

    const t = metrics.totals || {};
    const noPosts = (t.scheduled_posts || 0) === 0;

    const counters = [
        { label: "Impressions", value: t.impressions, icon: Eye, color: "#2563EB" },
        { label: "Clicks", value: t.clicks, icon: CursorClick, color: "#F59E0B" },
        { label: "Conversions", value: t.conversions, icon: UserCheck, color: "#10B981" },
        { label: "Posts", value: t.scheduled_posts, icon: RocketLaunch, color: "#0F172A", suffix: t.published_posts ? ` · ${t.published_posts} live` : "" },
    ];

    return (
        <div className="space-y-6" data-testid="marketing-metrics">
            {/* 4 KPI counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {counters.map((c) => (
                    <div key={c.label} className="zm-card p-5" data-testid={`metric-${c.label.toLowerCase()}`}>
                        <c.icon size={18} weight="bold" style={{ color: c.color }} />
                        <p className="font-display text-3xl font-black tracking-tight mt-2">{Number(c.value || 0).toLocaleString()}</p>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-[#64748B] font-bold mt-1">
                            {c.label}{c.suffix || ""}
                        </p>
                    </div>
                ))}
            </div>

            {/* Funnel summary row */}
            <div className="zm-card p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <p className="zm-section-label">Avg CTR</p>
                    <p className="font-display text-xl font-black tracking-tighter mt-1">{t.ctr_pct || 0}%</p>
                </div>
                <div className="md:border-l md:border-[#E2E8F0] md:pl-4">
                    <p className="zm-section-label">Conv rate</p>
                    <p className="font-display text-xl font-black tracking-tighter mt-1">{t.conv_rate_pct || 0}%</p>
                </div>
                <div className="md:border-l md:border-[#E2E8F0] md:pl-4">
                    <p className="zm-section-label">Real leads (period)</p>
                    <p className="font-display text-xl font-black tracking-tighter text-[#2563EB] mt-1">{t.real_leads_in_period || 0}</p>
                </div>
                <div className="md:border-l md:border-[#E2E8F0] md:pl-4">
                    <p className="zm-section-label">Converted (period)</p>
                    <p className="font-display text-xl font-black tracking-tighter text-[#10B981] mt-1">{t.converted_in_period || 0}</p>
                </div>
            </div>

            {noPosts ? (
                <div className="zm-card p-8 text-center" data-testid="metrics-empty">
                    <RocketLaunch size={28} weight="fill" className="mx-auto text-[#94A3B8] mb-2" />
                    <h3 className="font-display text-lg font-bold tracking-tight">No content scheduled yet</h3>
                    <p className="text-sm text-[#64748B] mt-1">
                        Go to <a href="/growth" className="text-[#2563EB] font-semibold underline">Growth Studio → Quick Plan</a> and click <em>Activate Execution Engine</em> to start generating posts.
                    </p>
                </div>
            ) : (
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Trend chart */}
                    <div className="zm-card p-5 lg:col-span-2" data-testid="metrics-trend">
                        <p className="zm-section-label mb-3">// Daily impressions × clicks × conversions</p>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={metrics.timeseries || []}>
                                <defs>
                                    <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#E2E8F0" />
                                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} stroke="#E2E8F0" />
                                <Tooltip contentStyle={{ background: "#0F172A", border: "none", borderRadius: 8, fontSize: 12, color: "#fff" }} />
                                <Area type="monotone" dataKey="impressions" stroke="#2563EB" strokeWidth={2} fill="url(#impGrad)" />
                                <Area type="monotone" dataKey="clicks" stroke="#F59E0B" strokeWidth={2} fill="transparent" />
                                <Area type="monotone" dataKey="conversions" stroke="#10B981" strokeWidth={2} fill="transparent" />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-4 text-[11px] mt-2 text-[#64748B]">
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-[#2563EB]" /> Impressions</span>
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-[#F59E0B]" /> Clicks</span>
                            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-[#10B981]" /> Conversions</span>
                        </div>
                    </div>

                    {/* By-platform breakdown */}
                    <div className="zm-card p-5" data-testid="metrics-platforms">
                        <p className="zm-section-label mb-3">// By channel</p>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={(metrics.by_platform || []).filter((p) => p.scheduled_posts > 0)}>
                                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="platform" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#E2E8F0" />
                                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} stroke="#E2E8F0" />
                                <Tooltip contentStyle={{ background: "#0F172A", border: "none", borderRadius: 8, fontSize: 12, color: "#fff" }} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="impressions" stackId="a" fill="#2563EB" />
                                <Bar dataKey="clicks" stackId="b" fill="#F59E0B" />
                                <Bar dataKey="conversions" stackId="c" fill="#10B981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Per-platform table */}
            {!noPosts && (
                <div className="zm-card overflow-hidden" data-testid="metrics-table">
                    <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <p className="zm-section-label">// Channel breakdown</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E2E8F0]">
                                    <th className="text-left px-5 py-3 zm-section-label">Channel</th>
                                    <th className="text-right px-3 py-3 zm-section-label">Posts (live / total)</th>
                                    <th className="text-right px-3 py-3 zm-section-label">Impressions</th>
                                    <th className="text-right px-3 py-3 zm-section-label">Clicks</th>
                                    <th className="text-right px-3 py-3 zm-section-label">Conv.</th>
                                    <th className="text-right px-5 py-3 zm-section-label">CTR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(metrics.by_platform || []).map((p) => {
                                    const meta = PLATFORM_META[p.platform] || { label: p.platform, icon: ChartBar, color: "#64748B" };
                                    const ctr = p.impressions ? ((p.clicks / p.impressions) * 100).toFixed(1) : "0.0";
                                    return (
                                        <tr key={p.platform} className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC]" data-testid={`metric-row-${p.platform}`}>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: meta.color }}>
                                                        <meta.icon size={14} weight="fill" className="text-white" />
                                                    </div>
                                                    <span className="font-bold">{meta.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono">{p.published_posts}/{p.scheduled_posts}</td>
                                            <td className="px-3 py-3 text-right font-mono">{p.impressions.toLocaleString()}</td>
                                            <td className="px-3 py-3 text-right font-mono">{p.clicks.toLocaleString()}</td>
                                            <td className="px-3 py-3 text-right font-mono font-bold text-[#10B981]">{p.conversions.toLocaleString()}</td>
                                            <td className="px-5 py-3 text-right font-mono">{ctr}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
