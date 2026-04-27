import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Sparkle, ArrowRight } from "@phosphor-icons/react";

export default function Register() {
    const navigate = useNavigate();
    const { register } = useAuth();
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
        } finally {
            setLoading(false);
        }
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
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Paste your URL — AI fills your profile</li>
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Set lead target — AI builds 12-month plan</li>
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Identifies your Ideal Customer Profile</li>
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Distributes budget paid + organic</li>
                        <li className="flex items-start gap-2"><span className="text-[#2563EB] font-bold">✓</span> Forecast alerts when you fall behind</li>
                    </ul>
                </div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-[#94A3B8] font-bold">
                    No credit card · Cancel anytime
                </div>
            </div>

            <div className="flex items-center justify-center p-8 lg:p-12">
                <form onSubmit={handleSubmit} className="w-full max-w-sm" data-testid="register-form">
                    <p className="zm-section-label mb-3">// Create account</p>
                    <h1 className="font-display text-3xl font-black tracking-tight mb-2 text-[#0F172A]">Start your trial.</h1>
                    <p className="text-sm text-[#64748B] mb-8">
                        Already have an account?{" "}
                        <Link to="/login" className="text-[#2563EB] font-semibold hover:underline" data-testid="link-login">
                            Sign in
                        </Link>
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="zm-label">First name</label>
                            <input className="zm-input" required value={form.first_name} onChange={update("first_name")} data-testid="register-firstname-input" autoFocus />
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
                        {loading ? "Creating account…" : "Create account & start trial"}
                        <ArrowRight size={16} weight="bold" />
                    </button>

                    <p className="text-[11px] text-[#94A3B8] text-center mt-4 font-semibold">
                        By signing up you agree to a 14-day free trial · no card needed
                    </p>
                </form>
            </div>
        </div>
    );
}
