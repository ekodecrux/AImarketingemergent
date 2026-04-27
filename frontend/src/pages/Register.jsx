import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Sparkle, ArrowRight, Envelope, Phone } from "@phosphor-icons/react";
import SmsAuthForm from "@/components/SmsAuthForm";

const GoogleIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.5-4.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16 4.5 9.1 9.1 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 45.5c5.4 0 10.3-2 14-5.3l-6.5-5.3c-2 1.4-4.5 2.2-7.5 2.2-5.2 0-9.6-3.3-11.2-8l-6.5 5C9 41 16 45.5 24 45.5z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.5 5.3c-.5.5 7-5 7-13.9 0-1.5-.2-3-.5-4.5z" />
    </svg>
);

export default function Register() {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [method, setMethod] = useState("email");
    const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
    const [loading, setLoading] = useState(false);

    const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register(form);
            toast.success("Account created");
            navigate("/onboarding");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Registration failed");
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
                    <span className="zm-tag-pill mb-6">// Free 14-day trial</span>
                    <h2 className="font-display text-4xl font-black tracking-tight leading-[1.1] mb-6 mt-6 text-[#0F172A]">
                        From signup to first lead in under 5 minutes.
                    </h2>
                    <ul className="space-y-3 text-sm text-[#475569]">
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Email, Google or SMS sign-up — your pick</li>
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Paste your URL — AI fills your profile</li>
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Set lead target — AI builds 12-month plan</li>
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Distributes budget paid + organic</li>
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Forecast alerts when you fall behind</li>
                    </ul>
                </div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-[#94A3B8] font-bold">
                    No credit card · Cancel anytime
                </div>
            </div>

            <div className="flex items-center justify-center p-8 lg:p-12">
                <div className="w-full max-w-sm">
                    <p className="zm-section-label mb-3">// Create account</p>
                    <h1 className="font-display text-3xl font-black tracking-tight mb-2 text-[#0F172A]">Start your trial.</h1>
                    <p className="text-sm text-[#64748B] mb-6">
                        Already have an account?{" "}
                        <Link to="/login" className="text-[#2563EB] font-semibold hover:underline" data-testid="link-login">Sign in</Link>
                    </p>

                    <button onClick={handleGoogle} className="zm-btn-secondary w-full mb-3" data-testid="register-google">
                        <GoogleIcon size={16} /> Sign up with Google
                    </button>

                    <div className="flex gap-1 p-1 bg-[#F8FAFC] rounded-md border border-[#E2E8F0] my-4" data-testid="register-method-tabs">
                        <button
                            onClick={() => setMethod("email")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded transition-colors ${method === "email" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"}`}
                            data-testid="register-tab-email"
                        >
                            <Envelope size={12} weight="bold" /> Email
                        </button>
                        <button
                            onClick={() => setMethod("sms")}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded transition-colors ${method === "sms" ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"}`}
                            data-testid="register-tab-sms"
                        >
                            <Phone size={12} weight="bold" /> SMS
                        </button>
                    </div>

                    {method === "email" && (
                        <form onSubmit={handleSubmit} data-testid="register-form">
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="zm-label">First name</label>
                                    <input className="zm-input" required value={form.first_name} onChange={update("first_name")} data-testid="register-firstname-input" />
                                </div>
                                <div>
                                    <label className="zm-label">Last name</label>
                                    <input className="zm-input" required value={form.last_name} onChange={update("last_name")} data-testid="register-lastname-input" />
                                </div>
                            </div>
                            <label className="zm-label">Work email</label>
                            <input type="email" required value={form.email} onChange={update("email")} className="zm-input mb-4" placeholder="you@company.com" data-testid="register-email-input" />
                            <label className="zm-label">Password (min 6 chars)</label>
                            <input type="password" required minLength={6} value={form.password} onChange={update("password")} className="zm-input mb-6" placeholder="••••••••" data-testid="register-password-input" />
                            <button type="submit" disabled={loading} className="zm-btn-primary w-full" data-testid="register-submit-button">
                                {loading ? "Creating account…" : "Create account & start trial"} <ArrowRight size={16} weight="bold" />
                            </button>
                        </form>
                    )}
                    {method === "sms" && <SmsAuthForm mode="register" />}

                    <p className="text-[11px] text-[#94A3B8] text-center mt-4 font-semibold">
                        14-day free trial · no card needed
                    </p>
                </div>
            </div>
        </div>
    );
}
