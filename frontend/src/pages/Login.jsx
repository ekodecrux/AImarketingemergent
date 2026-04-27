import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Sparkle, ArrowRight, ShieldCheck, Lightning, ChartLineUp, Envelope, Phone } from "@phosphor-icons/react";
import SmsAuthForm from "@/components/SmsAuthForm";

const GoogleIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.5-4.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16 4.5 9.1 9.1 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 45.5c5.4 0 10.3-2 14-5.3l-6.5-5.3c-2 1.4-4.5 2.2-7.5 2.2-5.2 0-9.6-3.3-11.2-8l-6.5 5C9 41 16 45.5 24 45.5z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.5 5.3c-.5.5 7-5 7-13.9 0-1.5-.2-3-.5-4.5z" />
    </svg>
);

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [method, setMethod] = useState("email"); // 'email' | 'sms'
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
        } finally { setLoading(false); }
    };

    const handleGoogle = () => {
        // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
        const redirectUrl = window.location.origin + "/auth/callback";
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr] bg-white">
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

            <div className="flex items-center justify-center p-8 lg:p-12">
                <div className="w-full max-w-sm">
                    <p className="zm-section-label mb-3">// Sign in</p>
                    <h1 className="font-display text-3xl font-black tracking-tight mb-2 text-[#0F172A]">Welcome back.</h1>
                    <p className="text-sm text-[#64748B] mb-6">
                        New here?{" "}
                        <Link to="/register" className="text-[#2563EB] font-semibold hover:underline" data-testid="link-register">
                            Start free trial
                        </Link>
                    </p>

                    {/* Google */}
                    <button onClick={handleGoogle} className="zm-btn-secondary w-full mb-3" data-testid="login-google">
                        <GoogleIcon size={16} /> Continue with Google
                    </button>

                    {/* Method tabs */}
                    <div className="flex gap-1 p-1 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] my-4" data-testid="login-method-tabs">
                        <button
                            onClick={() => setMethod("email")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded transition-colors ${method === "email" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"}`}
                            data-testid="login-tab-email"
                        >
                            <Envelope size={12} weight="bold" /> Email
                        </button>
                        <button
                            onClick={() => setMethod("sms")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded transition-colors ${method === "sms" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"}`}
                            data-testid="login-tab-sms"
                        >
                            <Phone size={12} weight="bold" /> SMS
                        </button>
                    </div>

                    {method === "email" && (
                        <form onSubmit={handleSubmit} data-testid="login-form">
                            <label className="zm-label">Email</label>
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="zm-input mb-4" placeholder="you@company.com" data-testid="login-email-input" />
                            <label className="zm-label">Password</label>
                            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="zm-input mb-6" placeholder="••••••••" data-testid="login-password-input" />
                            <button type="submit" disabled={loading} className="zm-btn-primary w-full" data-testid="login-submit-button">
                                {loading ? "Signing in…" : "Sign in"} <ArrowRight size={16} weight="bold" />
                            </button>
                        </form>
                    )}
                    {method === "sms" && <SmsAuthForm mode="login" />}

                    <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#94A3B8] font-bold mb-1.5">Demo credentials</p>
                        <p className="text-xs text-[#64748B] font-mono">admin@zeromark.ai · admin123</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
