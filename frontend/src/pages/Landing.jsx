import { Link } from "react-router-dom";
import {
    Sparkle, ArrowRight, CheckCircle, Robot, Target, Globe, Lightning,
    ChartLineUp, Megaphone, RocketLaunch,
} from "@phosphor-icons/react";
import {
    AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const GROWTH_DATA = [
    { m: "Jan", leads: 12, revenue: 4 },
    { m: "Feb", leads: 19, revenue: 6 },
    { m: "Mar", leads: 28, revenue: 11 },
    { m: "Apr", leads: 42, revenue: 18 },
    { m: "May", leads: 61, revenue: 28 },
    { m: "Jun", leads: 83, revenue: 41 },
    { m: "Jul", leads: 112, revenue: 58 },
    { m: "Aug", leads: 148, revenue: 79 },
    { m: "Sep", leads: 186, revenue: 104 },
];

export default function Landing() {
    return (
        <div className="min-h-screen bg-white">
            {/* Nav */}
            <header className="border-b border-[#E2E8F0]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#0F172A] flex items-center justify-center rounded-md">
                            <Sparkle size={16} weight="fill" className="text-[#2563EB]" />
                        </div>
                        <span className="font-display text-xl font-black tracking-tight">ZeroMark</span>
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <Link to="/audit" className="hidden sm:inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-[#10B981]/10 text-[#065F46] hover:bg-[#10B981]/20 transition-colors" data-testid="landing-free-audit">
                            ⚡ Free SEO audit
                        </Link>
                        <Link to="/login" className="text-sm font-semibold text-[#0F172A] hover:text-[#2563EB] px-2 sm:px-3 py-2" data-testid="landing-login">Sign in</Link>
                        <Link to="/register" className="zm-btn-primary text-xs sm:text-sm" data-testid="landing-register">
                            Start free <ArrowRight size={14} weight="bold" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero — tight, growth-chart-led */}
            <section className="bg-gradient-to-b from-[#F8FAFC] to-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 lg:py-16 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div>
                        <span className="zm-tag-pill mb-4">// Organic-first AI Marketing · Guaranteed Leads</span>
                        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] mt-4">
                            Get more leads.<br />Spend <span className="text-[#10B981]">70% less</span> than ad platforms.
                        </h1>
                        <p className="text-base text-[#475569] mt-5 max-w-xl leading-relaxed">
                            ZeroMark is built <strong>organic-first</strong>: SEO blogs, social posts, email outreach, landing pages — auto-generated daily and published for you. Paid ads only when you want them. Same lead targets, a fraction of the cost.
                        </p>
                        <div className="flex flex-wrap gap-2 sm:gap-3 mt-7">
                            <Link to="/register" className="zm-btn-primary text-sm sm:text-base px-6 py-3" data-testid="hero-cta-primary">
                                Start free · 14 days <ArrowRight size={16} weight="bold" />
                            </Link>
                            <Link to="/login" className="zm-btn-secondary text-sm sm:text-base px-6 py-3" data-testid="hero-cta-secondary">
                                See how it works
                            </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6 text-xs text-[#64748B] font-semibold">
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> No card required</span>
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> AI does 95% of the work</span>
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> Built for non-marketers</span>
                        </div>
                    </div>

                    {/* Growth chart visual */}
                    <div className="zm-card p-5 sm:p-7 shadow-lg shadow-[#2563EB]/5">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <p className="zm-section-label">// Live customer · 9 months</p>
                                <h3 className="font-display text-2xl font-black tracking-tight mt-1">+1,400% growth</h3>
                                <p className="text-xs text-[#64748B] mt-0.5">12 leads → 186 leads / month</p>
                            </div>
                            <span className="zm-badge bg-[#10B981] text-white">ON TRACK</span>
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={GROWTH_DATA}>
                                <defs>
                                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#64748B" }} stroke="#E2E8F0" />
                                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} stroke="#E2E8F0" />
                                <Tooltip contentStyle={{ background: "#0F172A", border: "none", borderRadius: 8, fontSize: 12, color: "#fff" }} />
                                <Area type="monotone" dataKey="leads" stroke="#2563EB" strokeWidth={2.5} fill="url(#growthGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#E2E8F0]">
                            <Stat label="Pipeline" v="$104K" delta="+89%" />
                            <Stat label="Conversions" v="34" delta="+22%" />
                            <Stat label="CPL" v="-41%" delta="vs Q1" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Customer happiness strip */}
            <section className="bg-[#0F172A] text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 lg:py-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-10">
                        {[
                            { v: "70%", l: "Cheaper vs paid-only" },
                            { v: "1,400%", l: "Avg lead growth" },
                            { v: "97%", l: "Customers hit target" },
                            { v: "2 min", l: "Setup → first plan" },
                        ].map((s) => (
                            <div key={s.l}>
                                <p className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#2563EB]">{s.v}</p>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 mt-1.5 font-bold">{s.l}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features grid */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-14 lg:py-20">
                <div className="grid md:grid-cols-12 gap-6 mb-10 items-end">
                    <div className="md:col-span-7">
                        <span className="zm-tag-pill mb-3">// One platform</span>
                        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.05] mt-4">
                            Replace 7 tools with <span className="text-[#2563EB]">one</span> growth engine.
                        </h2>
                    </div>
                    <p className="md:col-span-5 text-sm text-[#475569] leading-relaxed">
                        From URL to qualified leads — AI runs the whole funnel, with you in the loop.
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { icon: Target, title: "Ideal Customer Profile", desc: "Persona, firmographics, sample target companies — country-aware." },
                        { icon: ChartLineUp, title: "12-Month Growth Plan", desc: "Editable channel mix: paid + organic, budget-distributed." },
                        { icon: Globe, title: "Landing Pages", desc: "AI-generated copy, hosted at /p/{slug} — instant publish." },
                        { icon: Robot, title: "Daily Content Studio", desc: "Blog + meta + social posts + SEO keywords every day." },
                        { icon: Megaphone, title: "Multi-channel Send", desc: "Email · SMS · WhatsApp · LinkedIn · X · Instagram." },
                        { icon: Lightning, title: "Auto-publish Queue", desc: "Drag onto a 7-day calendar — system posts on time." },
                        { icon: RocketLaunch, title: "Forecast + Recovery", desc: "Real-time pace; auto-schedules extra content if behind." },
                        { icon: CheckCircle, title: "Guaranteed Leads", desc: "Set monthly target — system flags risk before month-end." },
                    ].map((f, i) => (
                        <div key={i} className="zm-card p-6 hover:shadow-md transition-all">
                            <div className="w-10 h-10 rounded-md bg-[#DBEAFE] flex items-center justify-center mb-3">
                                <f.icon size={18} weight="bold" className="text-[#2563EB]" />
                            </div>
                            <h3 className="font-display text-lg font-bold tracking-tight mb-1">{f.title}</h3>
                            <p className="text-sm text-[#64748B] leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="border-t border-[#E2E8F0] bg-[#F8FAFC] py-14 lg:py-20">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
                    <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.05] mb-4">
                        Marketing,<br className="sm:hidden" /> minus the <span className="text-[#2563EB]">noise</span>.
                    </h2>
                    <p className="text-base text-[#475569] mb-7">
                        Try every feature for 14 days. No card. Cancel in two clicks.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center">
                        <Link to="/register" className="zm-btn-primary text-base px-7 py-3" data-testid="cta-bottom">
                            Start free trial <ArrowRight size={16} weight="bold" />
                        </Link>
                        <Link to="/login" className="zm-btn-secondary text-base px-7 py-3">Sign in</Link>
                    </div>
                </div>
            </section>

            <footer className="bg-[#0F172A] text-white py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-[#2563EB] flex items-center justify-center rounded-md">
                            <Sparkle size={12} weight="fill" className="text-white" />
                        </div>
                        <span className="font-display text-lg font-black tracking-tight">ZeroMark</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold">
                        © {new Date().getFullYear()} ZeroMark AI · All rights reserved
                    </p>
                </div>
            </footer>
        </div>
    );
}

function Stat({ label, v, delta }) {
    return (
        <div>
            <p className="font-display text-lg font-black tracking-tight">{v}</p>
            <p className="text-[9px] uppercase tracking-[0.12em] text-[#10B981] font-bold">{delta}</p>
            <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-bold mt-0.5">{label}</p>
        </div>
    );
}
