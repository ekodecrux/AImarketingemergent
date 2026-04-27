import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Sparkle, ArrowRight, ShieldCheck, Lightning, ChartLineUp } from "@phosphor-icons/react";

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            toast.success("Welcome back");
            navigate("/dashboard");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-white">
            {/* Left brand panel — clean SaaS feel */}
            <div className="hidden lg:flex flex-col justify-between p-12 bg-[#F8FAFC] border-r border-[#E2E8F0]">
                <Link to="/" className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-[#0F172A] flex items-center justify-center rounded-md">
                        <Sparkle size={18} weight="fill" className="text-[#2563EB]" />
                    </div>
                    <span className="font-display text-2xl font-black tracking-tight text-[#0F172A]">ZeroMark</span>
                </Link>

                <div className="max-w-md">
                    <span className="zm-tag-pill mb-6">// AI Marketing OS</span>
                    <h2 className="font-display text-4xl font-black tracking-tight leading-[1.1] mb-6 mt-6 text-[#0F172A]">
                        The growth engine that runs while you sleep.
                    </h2>
                    <div className="space-y-3 mt-8">
                        {[
                            { icon: Lightning, text: "AI builds your 12-month plan with paid + organic mix" },
                            { icon: ChartLineUp, text: "Real-time forecast vs your monthly lead target" },
                            { icon: ShieldCheck, text: "Forecast alerts via Email + Slack with corrective actions" },
                        ].map((it, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-md bg-[#DBEAFE] flex items-center justify-center shrink-0">
                                    <it.icon size={14} weight="bold" className="text-[#2563EB]" />
                                </div>
                                <p className="text-sm text-[#475569] leading-relaxed pt-1.5">{it.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="text-[11px] uppercase tracking-[0.15em] text-[#94A3B8] font-bold">
                    Trusted by growth teams · 14-day free trial
                </div>
            </div>

            {/* Right form panel */}
            <div className="flex items-center justify-center p-8 lg:p-12">
                <form onSubmit={handleSubmit} className="w-full max-w-sm" data-testid="login-form">
                    <p className="zm-section-label mb-3">// Sign in</p>
                    <h1 className="font-display text-3xl font-black tracking-tight mb-2 text-[#0F172A]">Welcome back.</h1>
                    <p className="text-sm text-[#64748B] mb-8">
                        New here?{" "}
                        <Link to="/register" className="text-[#2563EB] font-semibold hover:underline" data-testid="link-register">
                            Start free trial
                        </Link>
                    </p>

                    <label className="zm-label">Email</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="zm-input mb-4"
                        placeholder="you@company.com"
                        autoFocus
                        data-testid="login-email-input"
                    />

                    <label className="zm-label">Password</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="zm-input mb-6"
                        placeholder="••••••••"
                        data-testid="login-password-input"
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="zm-btn-primary w-full"
                        data-testid="login-submit-button"
                    >
                        {loading ? "Signing in…" : "Sign in"}
                        <ArrowRight size={16} weight="bold" />
                    </button>

                    <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] font-bold mb-1.5">Demo credentials</p>
                        <p className="text-xs text-[#64748B] font-mono">admin@zeromark.ai · admin123</p>
                    </div>
                </form>
            </div>
        </div>
    );
}
