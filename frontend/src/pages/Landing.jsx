import { Link } from "react-router-dom";
import {
    Sparkle, ArrowRight, Lightning, Megaphone, ChartLineUp,
    Users, CheckCircle, Robot, Target, Globe,
} from "@phosphor-icons/react";

export default function Landing() {
    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Nav */}
            <header className="bg-[#F8FAFC]">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-[#0F172A] flex items-center justify-center rounded-xl">
                            <Sparkle size={18} weight="fill" className="text-[#2563EB]" />
                        </div>
                        <span className="font-display text-2xl font-black tracking-tight">ZeroMark</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to="/login" className="text-sm font-semibold text-[#0F172A] hover:text-[#2563EB] px-3 py-2" data-testid="landing-login">Sign in</Link>
                        <Link to="/register" className="zm-btn-primary" data-testid="landing-register">
                            Start free <ArrowRight size={14} weight="bold" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24 grid lg:grid-cols-12 gap-12 items-center relative">
                    {/* Decorative blob */}
                    <div className="absolute top-10 right-0 w-[500px] h-[500px] rounded-full bg-[#DBEAFE] blur-3xl opacity-70 -z-0"></div>
                    <div className="absolute bottom-0 left-1/3 w-[300px] h-[300px] rounded-full bg-[#E0E7FF] blur-3xl opacity-50 -z-0"></div>

                    <div className="lg:col-span-7 relative z-10">
                        <span className="zm-tag-pill mb-6"><Sparkle size={11} weight="fill" className="text-[#2563EB] mr-1" /> AI Marketing OS</span>
                        <h1 className="font-display text-5xl md:text-7xl lg:text-[88px] font-black tracking-[-0.035em] leading-[1.0] mt-6">
                            Convert more with<br />
                            marketing that <span className="text-[#2563EB]">actually</span><br />
                            works.
                        </h1>
                        <p className="text-base md:text-lg text-[#3F3F46] mt-8 max-w-xl leading-relaxed">
                            Build landing pages, capture leads, automate outreach across every channel — and let AI distribute your budget between paid &amp; organic for guaranteed pipeline.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-10">
                            <Link to="/register" className="zm-btn-primary text-base px-7 py-3.5" data-testid="hero-cta-primary">
                                Start 14-day trial <ArrowRight size={16} weight="bold" />
                            </Link>
                            <Link to="/login" className="zm-btn-secondary text-base px-7 py-3.5" data-testid="hero-cta-secondary">
                                Watch demo
                            </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-6 mt-8 text-xs text-[#52525B] font-semibold">
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> No credit card</span>
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> Setup in 2 min</span>
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> Cancel anytime</span>
                        </div>
                    </div>
                    <div className="lg:col-span-5 relative z-10">
                        <div className="relative">
                            {/* Mock dashboard card stack */}
                            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-lg shadow-[#2563EB]/5">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="zm-section-label">Live · Last 24h</span>
                                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                                </div>
                                <div className="font-display text-5xl font-black tracking-tighter">+$48.2K</div>
                                <p className="text-xs text-[#71717A] mt-1 font-semibold">REVENUE THIS MONTH</p>
                                <div className="mt-5 space-y-2.5">
                                    {[
                                        ["Google Ads", "Paid", 32, "#2563EB"],
                                        ["SEO", "Organic", 24, "#10B981"],
                                        ["Cold Email", "Organic", 18, "#0F172A"],
                                        ["LinkedIn", "Paid", 14, "#F59E0B"],
                                    ].map(([n, t, p, c]) => (
                                        <div key={n}>
                                            <div className="flex justify-between text-xs mb-1 font-semibold">
                                                <span>{n} <span className="text-[#A1A1AA] uppercase tracking-wider text-[9px] ml-1">{t}</span></span>
                                                <span>{p} leads</span>
                                            </div>
                                            <div className="h-2 bg-[#F8FAFC] rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${p * 2.5}%`, background: c }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="absolute -bottom-5 -left-5 bg-[#0F172A] text-white px-5 py-3 rounded-xl shadow-lg hidden md:block">
                                <p className="font-display text-2xl font-black tracking-tight"><span className="text-[#2563EB]">87%</span> on track</p>
                                <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80">Monthly target</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Logos / Social proof strip */}
            <section className="border-y border-[#E2E8F0] bg-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10">
                    <p className="text-center text-xs uppercase tracking-[0.25em] font-bold text-[#71717A] mb-6">Trusted by 1000+ growth teams</p>
                    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-60">
                        {["ACME", "STELLA", "OUTPOST", "PHOENIX", "VECTRA", "NORTH&CO"].map((n) => (
                            <span key={n} className="font-display text-2xl font-black tracking-tighter text-[#0F172A]">{n}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features grid */}
            <section className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
                <div className="grid md:grid-cols-12 gap-8 mb-14 items-end">
                    <div className="md:col-span-7">
                        <span className="zm-tag-pill mb-4">// Built for growth</span>
                        <h2 className="font-display text-4xl md:text-6xl font-black tracking-tighter leading-[1.0] mt-5">
                            One platform.<br />
                            Every <span className="text-[#2563EB]">growth</span> step.
                        </h2>
                    </div>
                    <p className="md:col-span-5 text-base text-[#3F3F46] leading-relaxed">
                        From landing pages to lead capture to multi-channel outreach with AI-distributed budgets — replace five tools and the manual ops between them.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[
                        { icon: Globe, title: "Landing Page Builder", desc: "AI-generated copy, drag-and-drop sections, instant publish on a hosted URL.", c: "#2563EB" },
                        { icon: Robot, title: "AI Copywriting", desc: "Groq-powered drafting tuned to your business profile, channel and tone.", c: "#10B981" },
                        { icon: Target, title: "Paid + Organic Mix", desc: "AI distributes budgets between Google Ads, SEO, content & cold outreach.", c: "#F59E0B" },
                        { icon: Megaphone, title: "6 Channels", desc: "Email, SMS, WhatsApp, Facebook, Instagram, LinkedIn — from one composer.", c: "#2563EB" },
                        { icon: ChartLineUp, title: "Real-time Analytics", desc: "Live revenue, pipeline value, target progress — all updated by the second.", c: "#0F172A" },
                        { icon: CheckCircle, title: "Guaranteed Leads", desc: "Set monthly lead targets, track pace and forecast in one dashboard.", c: "#10B981" },
                    ].map((f, i) => (
                        <div key={i} className="zm-card p-7 hover:shadow-md hover:-translate-y-0.5 transition-all">
                            <div className="w-12 h-12 flex items-center justify-center mb-5 rounded-2xl" style={{ background: f.c }}>
                                <f.icon size={22} weight="fill" className="text-white" />
                            </div>
                            <h3 className="font-display text-2xl font-black tracking-tight mb-2">{f.title}</h3>
                            <p className="text-sm text-[#52525B] leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Stats strip */}
            <section className="bg-[#0F172A] text-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {[
                        ["6×", "Channels"],
                        ["3.4×", "Avg ROI"],
                        ["48h", "Avg setup"],
                        ["$0", "To get started"],
                    ].map(([v, l]) => (
                        <div key={l}>
                            <p className="font-display text-5xl md:text-7xl font-black tracking-tighter text-[#2563EB]">{v}</p>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-white/70 mt-2 font-bold">{l}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="bg-[#F8FAFC] py-24">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <span className="zm-tag-pill mb-6">// Ready when you are</span>
                    <h2 className="font-display text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[1.0] mt-6">
                        Marketing,<br />minus the <span className="text-[#2563EB]">noise</span>.
                    </h2>
                    <p className="text-base md:text-lg text-[#3F3F46] max-w-xl mx-auto mb-10">
                        Try every feature for 14 days. No credit card. Cancel from the billing page in two clicks.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center">
                        <Link to="/register" className="zm-btn-primary text-base px-8 py-4" data-testid="cta-bottom">
                            Start free trial <ArrowRight size={16} weight="bold" />
                        </Link>
                        <Link to="/login" className="zm-btn-secondary text-base px-8 py-4">Sign in</Link>
                    </div>
                </div>
            </section>

            <footer className="bg-[#0F172A] text-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#2563EB] flex items-center justify-center rounded-xl">
                            <Sparkle size={14} weight="fill" className="text-white" />
                        </div>
                        <span className="font-display text-xl font-black tracking-tight">ZeroMark</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold">
                        © {new Date().getFullYear()} ZeroMark AI · All rights reserved
                    </p>
                </div>
            </footer>
        </div>
    );
}
