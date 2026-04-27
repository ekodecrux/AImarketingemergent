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
        <div className="min-h-screen grid lg:grid-cols-2 bg-white">
            <div className="hidden lg:flex flex-col justify-between p-12 bg-[#FF562D] text-white relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white flex items-center justify-center">
                            <Sparkle size={18} weight="fill" className="text-[#FF562D]" />
                        </div>
                        <span className="font-display text-2xl font-black tracking-tighter">ZEROMARK</span>
                    </div>
                </div>
                <div className="relative z-10 max-w-md">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-4">// Get started</p>
                    <h2 className="font-display text-5xl font-black tracking-tighter leading-[1.05] mb-6">
                        14 days.<br/>Zero credit card.<br/>All channels.
                    </h2>
                    <p className="text-base text-white/80 leading-relaxed">
                        Generate AI marketing copy, scrape leads, run approval workflows, and send through email,
                        SMS, WhatsApp & social. Free for two weeks.
                    </p>
                </div>
                <div className="relative z-10 text-[10px] uppercase tracking-[0.3em] text-white/60">
                    NO CARD REQUIRED
                </div>
            </div>

            <div className="flex items-center justify-center p-8 lg:p-12">
                <form onSubmit={handleSubmit} className="w-full max-w-sm" data-testid="register-form">
                    <p className="zm-section-label mb-3">// Create account</p>
                    <h1 className="font-display text-4xl font-black tracking-tighter mb-2">Start your trial.</h1>
                    <p className="text-sm text-[#71717A] mb-8">
                        Already have an account?{" "}
                        <Link to="/login" className="text-[#FF562D] font-semibold underline underline-offset-2" data-testid="link-login">
                            Sign in
                        </Link>
                    </p>

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

                    <label className="zm-label">Email</label>
                    <input type="email" required value={form.email} onChange={update("email")} className="zm-input mb-4" data-testid="register-email-input" />

                    <label className="zm-label">Password</label>
                    <input type="password" required minLength={6} value={form.password} onChange={update("password")} className="zm-input mb-6" data-testid="register-password-input" />

                    <button type="submit" disabled={loading} className="zm-btn-primary w-full" data-testid="register-submit-button">
                        {loading ? "Creating..." : "Create account"}
                        <ArrowRight size={16} weight="bold" />
                    </button>
                </form>
            </div>
        </div>
    );
}
