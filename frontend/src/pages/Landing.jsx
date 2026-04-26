import { Link } from "react-router-dom";
import {
    Sparkle, ArrowRight, Lightning, Megaphone, ChartLineUp,
    Users, CheckCircle, Robot,
} from "@phosphor-icons/react";

export default function Landing() {
    return (
        <div className="min-h-screen bg-[#F4F4F5]">
            {/* Nav */}
            <header className="bg-white border-b border-[#E4E4E7]">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#002EB8] flex items-center justify-center">
                            <Sparkle size={18} weight="fill" className="text-white" />
                        </div>
                        <span className="font-display text-xl font-black tracking-tighter">ZEROMARK</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link to="/login" className="zm-btn-secondary" data-testid="landing-login">Sign in</Link>
                        <Link to="/register" className="zm-btn-primary" data-testid="landing-register">
                            Start free trial <ArrowRight size={14} weight="bold" />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="bg-white border-b border-[#E4E4E7]">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-32 grid lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-7">
                        <p className="zm-section-label mb-6">// AI marketing engine — v1.0</p>
                        <h1 className="font-display text-5xl md:text-7xl lg:text-[88px] font-black tracking-[-0.04em] leading-[0.95]">
                            Scrape.<br />
                            Generate.<br />
                            <span className="text-[#002EB8]">Convert.</span>
                        </h1>
                        <p className="text-base md:text-lg text-[#71717A] mt-8 max-w-xl leading-relaxed">
                            ZeroMark is a no-frills B2B marketing engine. Plug in your business once.
                            We discover leads, draft campaigns with AI, route everything through approval,
                            and ship across email, SMS, WhatsApp & social.
                        </p>
                        <div className="flex flex-wrap gap-3 mt-10">
                            <Link to="/register" className="zm-btn-primary" data-testid="hero-cta-primary">
                                Start 14-day trial <ArrowRight size={14} weight="bold" />
                            </Link>
                            <Link to="/login" className="zm-btn-dark" data-testid="hero-cta-secondary">
                                Live demo
                            </Link>
                        </div>
                        <div className="flex flex-wrap items-center gap-6 mt-10 text-xs text-[#71717A] uppercase tracking-[0.15em] font-bold">
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> No credit card</span>
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> Setup in 2 min</span>
                            <span className="flex items-center gap-1.5"><CheckCircle size={14} weight="fill" className="text-[#10B981]" /> Cancel anytime</span>
                        </div>
                    </div>
                    <div className="lg:col-span-5 relative">
                        <div className="relative bg-[#09090B] aspect-[4/3] overflow-hidden">
                            <div className="absolute inset-0 opacity-40" style={{
                                backgroundImage: "url(https://images.unsplash.com/photo-1765408217205-1c42d81f1677?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200)",
                                backgroundSize: "cover", backgroundPosition: "center",
                            }} />
                            <div className="absolute inset-x-6 bottom-6 bg-white border border-[#E4E4E7] p-5">
                                <p className="zm-section-label mb-2">// AI generation</p>
                                <h3 className="font-display text-lg font-bold tracking-tight mb-3">Subject: Stop losing leads at 2am</h3>
                                <p className="text-xs text-[#71717A] font-mono leading-relaxed">
                                    Hi {`{{name}}`}, our zero-touch outreach engine ran while you slept and qualified 47 prospects matching your ICP…
                                </p>
                                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#E4E4E7]">
                                    <Robot size={14} weight="fill" className="text-[#002EB8]" />
                                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#71717A]">Generated by Groq · 0.6s</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats strip */}
            <section className="bg-[#09090B] text-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {[
                        ["6×", "Channels"],
                        ["AI", "Content gen"],
                        ["1-click", "Approvals"],
                        ["Live", "Pipeline view"],
                    ].map(([v, l]) => (
                        <div key={l}>
                            <p className="font-display text-4xl md:text-5xl font-black tracking-tighter">{v}</p>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 mt-2 font-bold">{l}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features grid */}
            <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
                <div className="grid md:grid-cols-12 gap-8 mb-12 items-end">
                    <div className="md:col-span-7">
                        <p className="zm-section-label mb-4">// What it does</p>
                        <h2 className="font-display text-4xl md:text-5xl font-black tracking-tighter leading-[1.05]">
                            One platform.<br />Every step of outreach.
                        </h2>
                    </div>
                    <p className="md:col-span-5 text-base text-[#71717A] leading-relaxed">
                        From discovering net-new leads to hitting send — ZeroMark replaces five disconnected
                        tools and the people who string them together.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-0 zm-card">
                    {[
                        { icon: Users, title: "Lead Discovery", desc: "AI-powered scrape from Google Maps, LinkedIn, competitor sites. Auto-imported into your pipeline." },
                        { icon: Robot, title: "AI Copywriting", desc: "Groq-powered campaign drafting tuned to your business profile, channel and tone." },
                        { icon: CheckCircle, title: "Approval Queue", desc: "Every campaign requires human sign-off. Approve, reject or modify in one click." },
                        { icon: Megaphone, title: "6 Channels", desc: "Email · SMS · WhatsApp · Facebook · Instagram · LinkedIn — from one composer." },
                        { icon: Lightning, title: "Twilio + Gmail", desc: "Real SMS delivery via Twilio and email via SMTP. Zero placeholders." },
                        { icon: ChartLineUp, title: "Reports & Gap Analysis", desc: "Lead performance, campaign metrics, AI gap analysis with growth suggestions." },
                    ].map((f, i) => (
                        <div key={i} className={`p-8 ${i % 3 !== 2 ? "lg:border-r" : ""} ${i % 2 !== 1 ? "md:border-r" : ""} ${i < 3 ? "lg:border-b" : ""} md:border-b border-[#E4E4E7] last:border-b-0`}>
                            <div className="w-10 h-10 bg-[#F4F4F5] flex items-center justify-center mb-4">
                                <f.icon size={20} weight="bold" />
                            </div>
                            <h3 className="font-display text-xl font-bold tracking-tight mb-2">{f.title}</h3>
                            <p className="text-sm text-[#71717A] leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="bg-[#002EB8] text-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 text-center">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-4 font-bold">// Ready when you are</p>
                    <h2 className="font-display text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-[1.05]">
                        Marketing,<br />minus the noise.
                    </h2>
                    <p className="text-base text-white/80 max-w-xl mx-auto mb-8">
                        Try every feature for 14 days. No credit card. Cancel from the billing page in two clicks.
                    </p>
                    <Link to="/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#002EB8] font-semibold uppercase tracking-[0.1em] text-sm hover:bg-[#F4F4F5] transition-colors" data-testid="cta-bottom">
                        Start free trial <ArrowRight size={16} weight="bold" />
                    </Link>
                </div>
            </section>

            <footer className="bg-white border-t border-[#E4E4E7]">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#002EB8] flex items-center justify-center">
                            <Sparkle size={12} weight="fill" className="text-white" />
                        </div>
                        <span className="font-display text-sm font-black tracking-tighter">ZEROMARK</span>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#71717A] font-bold">
                        © {new Date().getFullYear()} ZEROMARK AI · ALL RIGHTS RESERVED
                    </p>
                </div>
            </footer>
        </div>
    );
}
