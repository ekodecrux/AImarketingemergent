import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    Pulse, CurrencyDollar, Users, Target, TrendUp, ChartLineUp,
    Sparkle, FloppyDisk, ShieldCheck, ArrowsClockwise,
} from "@phosphor-icons/react";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const SOURCE_COLORS = ["#FF562D", "#0FB39A", "#0E0F11", "#FFD300", "#A855F7"];

export default function Analytics() {
    const [live, setLive] = useState(null);
    const [revenue, setRevenue] = useState(null);
    const [target, setTarget] = useState(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        monthly_lead_target: 50,
        avg_deal_value_usd: 250,
        guarantee_enabled: false,
        guarantee_terms: "",
    });
    const [saving, setSaving] = useState(false);

    const load = () => {
        api.get("/analytics/realtime").then((r) => {
            setLive(r.data);
            const t = r.data.target;
            setForm({
                monthly_lead_target: t.monthly_lead_target || 50,
                avg_deal_value_usd: t.avg_deal_value_usd || 250,
                guarantee_enabled: t.guarantee_enabled || false,
                guarantee_terms: t.guarantee_terms || "",
            });
        });
        api.get("/analytics/revenue?months=6").then((r) => setRevenue(r.data.months));
        api.get("/lead-targets").then((r) => setTarget(r.data.target));
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 30000); // refresh every 30s
        return () => clearInterval(t);
        // eslint-disable-next-line
    }, []);

    const saveTarget = async () => {
        setSaving(true);
        try {
            await api.post("/lead-targets", form);
            toast.success("Target saved");
            setEditing(false);
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed");
        } finally { setSaving(false); }
    };

    if (!live) return <div className="p-12 text-sm text-[#71717A]">Loading…</div>;

    const fmt = (n) => `$${Math.round(n).toLocaleString()}`;

    return (
        <div data-testid="analytics-page">
            <PageHeader
                eyebrow={<><span className="w-2 h-2 inline-block rounded-full bg-[#0FB39A] animate-pulse mr-2"></span>Live · auto-refreshes every 30s</>}
                title="Real-time Analytics"
                subtitle="Pipeline value, monthly revenue and target pace at a glance."
                action={
                    <button onClick={load} className="zm-btn-secondary" data-testid="analytics-refresh">
                        <ArrowsClockwise size={14} weight="bold" /> Refresh
                    </button>
                }
            />
            <div className="px-8 py-6 space-y-6">
                {/* Live counters */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="live-counters">
                    <Counter icon={Pulse} label="Last hour" value={live.live.leads_last_hour} sub="leads" color="#FF562D" highlight />
                    <Counter icon={Users} label="Today" value={live.live.leads_today} sub="leads" color="#0E0F11" />
                    <Counter icon={Users} label="This month" value={live.live.leads_this_month} sub="leads" color="#0FB39A" />
                    <Counter icon={Target} label="Converted" value={live.live.converted_this_month} sub="this month" color="#FFD300" />
                    <Counter icon={CurrencyDollar} label="Revenue" value={fmt(live.live.revenue_this_month)} sub="this month" color="#FF562D" />
                    <Counter icon={ChartLineUp} label="Pipeline" value={fmt(live.live.pipeline_value)} sub="estimated" color="#0E0F11" />
                </div>

                {/* Target progress + Guarantee */}
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 zm-card p-7" data-testid="target-progress-card">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <p className="zm-section-label mb-1">// Monthly target</p>
                                <h3 className="font-display text-3xl font-black tracking-tighter">Guaranteed Leads</h3>
                                <p className="text-xs text-[#71717A] mt-1">
                                    {live.target.on_track === null
                                        ? "Set a target to track guaranteed leads"
                                        : live.target.on_track
                                            ? <span className="text-[#0FB39A] font-semibold">On track to hit target this month</span>
                                            : <span className="text-[#FF562D] font-semibold">Forecasted to miss target — increase paid budget?</span>}
                                </p>
                            </div>
                            <button onClick={() => setEditing(!editing)} className="zm-btn-secondary text-xs" data-testid="edit-target-btn">
                                {editing ? "Cancel" : "Edit target"}
                            </button>
                        </div>

                        {editing ? (
                            <div className="grid sm:grid-cols-2 gap-4 bg-[#FAF7F2] p-5 rounded-2xl border border-[#EDE5D4]" data-testid="target-edit-form">
                                <div>
                                    <label className="zm-label">Monthly lead target</label>
                                    <input type="number" min="1" className="zm-input" value={form.monthly_lead_target}
                                        onChange={(e) => setForm({ ...form, monthly_lead_target: parseInt(e.target.value) || 0 })}
                                        data-testid="input-monthly-lead-target" />
                                </div>
                                <div>
                                    <label className="zm-label">Avg deal value (USD)</label>
                                    <input type="number" min="0" className="zm-input" value={form.avg_deal_value_usd}
                                        onChange={(e) => setForm({ ...form, avg_deal_value_usd: parseFloat(e.target.value) || 0 })}
                                        data-testid="input-avg-deal-value" />
                                </div>
                                <div className="sm:col-span-2 flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#EDE5D4]">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, guarantee_enabled: !form.guarantee_enabled })}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${form.guarantee_enabled ? "bg-[#FF562D]" : "bg-[#EDE5D4]"}`}
                                        data-testid="input-guarantee-enabled"
                                        aria-pressed={form.guarantee_enabled}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.guarantee_enabled ? "translate-x-5" : ""}`}></span>
                                    </button>
                                    <label onClick={() => setForm({ ...form, guarantee_enabled: !form.guarantee_enabled })} className="text-sm font-semibold cursor-pointer flex items-center gap-1.5 select-none">
                                        <ShieldCheck size={14} weight="fill" className="text-[#FF562D]" />
                                        Enable lead guarantee terms
                                    </label>
                                </div>
                                {form.guarantee_enabled && (
                                    <div className="sm:col-span-2">
                                        <label className="zm-label">Guarantee terms (visible to your team)</label>
                                        <textarea rows={2} className="zm-input" value={form.guarantee_terms}
                                            onChange={(e) => setForm({ ...form, guarantee_terms: e.target.value })}
                                            placeholder="e.g. Refund 25% of fee if leads delivered are <80% of target."
                                            data-testid="input-guarantee-terms" />
                                    </div>
                                )}
                                <div className="sm:col-span-2 flex justify-end gap-2">
                                    <button onClick={saveTarget} disabled={saving} className="zm-btn-primary" data-testid="save-target-btn">
                                        <FloppyDisk size={14} weight="bold" /> {saving ? "Saving…" : "Save target"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <ProgressBar
                                    label="Leads"
                                    current={live.live.leads_this_month}
                                    target={live.target.monthly_lead_target}
                                    forecast={live.target.forecast_leads}
                                    pct={live.target.leads_progress_pct}
                                    suffix="leads"
                                />
                                <ProgressBar
                                    label="Revenue"
                                    current={live.live.revenue_this_month}
                                    target={live.target.monthly_revenue_target_usd}
                                    forecast={live.target.forecast_revenue}
                                    pct={live.target.revenue_progress_pct}
                                    isCurrency
                                />
                                {live.target.guarantee_enabled && live.target.guarantee_terms && (
                                    <div className="mt-4 bg-[#FFE6DC] rounded-2xl p-4 flex gap-3">
                                        <ShieldCheck size={18} weight="fill" className="text-[#FF562D] mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.12em] font-bold text-[#FF562D] mb-1">Lead Guarantee Active</p>
                                            <p className="text-sm text-[#0E0F11]">{live.target.guarantee_terms}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Forecast card */}
                    <div className="zm-card p-7 bg-[#0E0F11] text-white" data-testid="forecast-card">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60 mb-1">// Month forecast</p>
                        <p className="font-display text-5xl font-black tracking-tighter mt-3 text-[#FF562D]">{live.target.forecast_leads}</p>
                        <p className="text-xs text-white/70 font-semibold uppercase tracking-wider mt-1">Projected leads</p>

                        <div className="my-5 h-px bg-white/10"></div>

                        <p className="font-display text-3xl font-black tracking-tighter">{fmt(live.target.forecast_revenue)}</p>
                        <p className="text-xs text-white/70 font-semibold uppercase tracking-wider mt-1">Projected revenue</p>

                        <div className="my-5 h-px bg-white/10"></div>

                        <div className="flex items-center gap-2">
                            <TrendUp size={16} weight="bold" className="text-[#FF562D]" />
                            <p className="text-xs">Updates in real time as new leads come in</p>
                        </div>
                    </div>
                </div>

                {/* Hourly + Sources */}
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 zm-card p-7" data-testid="hourly-chart">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <p className="zm-section-label">// Activity</p>
                                <h3 className="font-display text-2xl font-black tracking-tight mt-1">Last 24 hours</h3>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={live.charts.hourly_leads_24h}>
                                <defs>
                                    <linearGradient id="leadgrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#FF562D" stopOpacity={0.45} />
                                        <stop offset="100%" stopColor="#FF562D" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="#EDE5D4" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#71717A" }} stroke="#EDE5D4" interval={3} />
                                <YAxis tick={{ fontSize: 10, fill: "#71717A" }} stroke="#EDE5D4" allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ background: "#0E0F11", border: "none", borderRadius: 12, fontSize: 12, color: "#fff" }}
                                    cursor={{ fill: "rgba(255,86,45,0.05)" }}
                                />
                                <Area type="monotone" dataKey="count" stroke="#FF562D" strokeWidth={2.5} fill="url(#leadgrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="zm-card p-7" data-testid="sources-chart">
                        <p className="zm-section-label">// Source mix</p>
                        <h3 className="font-display text-2xl font-black tracking-tight mt-1 mb-4">This month</h3>
                        {live.charts.sources_this_month.length === 0 ? (
                            <p className="text-sm text-[#A1A1AA] py-12 text-center">No leads yet</p>
                        ) : (
                            <div className="space-y-3">
                                {live.charts.sources_this_month.slice(0, 5).map((s, i) => {
                                    const total = live.charts.sources_this_month.reduce((acc, x) => acc + x.value, 0);
                                    const pct = total ? Math.round((s.value / total) * 100) : 0;
                                    return (
                                        <div key={s.name}>
                                            <div className="flex justify-between text-xs mb-1.5 font-semibold">
                                                <span>{s.name}</span>
                                                <span>{s.value} <span className="text-[#A1A1AA]">({pct}%)</span></span>
                                            </div>
                                            <div className="h-2 bg-[#FAF7F2] rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Revenue trend */}
                {revenue && (
                    <div className="zm-card p-7" data-testid="revenue-trend">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <p className="zm-section-label">// Revenue trend</p>
                                <h3 className="font-display text-2xl font-black tracking-tight mt-1">Last 6 months</h3>
                            </div>
                            <span className="zm-badge bg-[#FFE6DC] text-[#FF562D]">
                                <Sparkle size={10} weight="fill" className="mr-1" /> Auto-tracked
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={revenue}>
                                <CartesianGrid stroke="#EDE5D4" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#52525B" }} stroke="#EDE5D4" />
                                <YAxis tick={{ fontSize: 11, fill: "#52525B" }} stroke="#EDE5D4" />
                                <Tooltip
                                    contentStyle={{ background: "#0E0F11", border: "none", borderRadius: 12, fontSize: 12, color: "#fff" }}
                                    cursor={{ fill: "rgba(255,86,45,0.05)" }}
                                />
                                <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                                    {revenue.map((_, i) => (
                                        <Cell key={i} fill={i === revenue.length - 1 ? "#FF562D" : "#0E0F11"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}

function Counter({ icon: Icon, label, value, sub, color, highlight }) {
    return (
        <div
            className={`zm-card p-5 relative overflow-hidden ${highlight ? "ring-2 ring-[#FF562D]" : ""}`}
            data-testid={`counter-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
            {highlight && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF562D] animate-pulse"></span>}
            <Icon size={18} weight="fill" style={{ color }} />
            <p className="font-display text-3xl font-black tracking-tighter mt-2">{value}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#71717A] font-bold mt-1">{label} · {sub}</p>
        </div>
    );
}

function ProgressBar({ label, current, target, forecast, pct, suffix, isCurrency }) {
    const fmtv = (n) => isCurrency ? `$${Math.round(n).toLocaleString()}` : `${Math.round(n).toLocaleString()}${suffix ? ` ${suffix}` : ""}`;
    const clampedPct = Math.min(100, pct || 0);
    const forecastPct = target ? Math.min(120, (forecast / target) * 100) : 0;
    const onTrack = forecast >= target && target > 0;
    return (
        <div data-testid={`progress-${label.toLowerCase()}`}>
            <div className="flex items-baseline justify-between mb-2">
                <div>
                    <span className="font-display text-3xl font-black tracking-tighter">{fmtv(current)}</span>
                    <span className="text-sm text-[#71717A] font-semibold ml-2">/ {fmtv(target)} {label.toLowerCase()}</span>
                </div>
                <span className={`zm-badge ${onTrack ? "bg-[#0FB39A] text-white" : "bg-[#FFE6DC] text-[#FF562D]"}`}>
                    {clampedPct}% achieved
                </span>
            </div>
            <div className="relative h-3 bg-[#FAF7F2] rounded-full overflow-hidden border border-[#EDE5D4]">
                <div className="absolute h-full bg-[#FF562D] rounded-full" style={{ width: `${clampedPct}%` }}></div>
                {target > 0 && (
                    <div
                        className="absolute top-0 h-full border-r-2 border-dashed border-[#0E0F11] opacity-60"
                        style={{ left: `${Math.min(100, forecastPct)}%` }}
                        title={`Forecast: ${fmtv(forecast)}`}
                    ></div>
                )}
            </div>
            <p className="text-[11px] text-[#71717A] font-semibold mt-1.5">
                Forecast end-of-month: <span className="text-[#0E0F11] font-bold">{fmtv(forecast)}</span>
                {target > 0 && (
                    onTrack
                        ? <span className="text-[#0FB39A] ml-2">✓ on track</span>
                        : <span className="text-[#FF562D] ml-2">⚠ behind pace</span>
                )}
            </p>
        </div>
    );
}
