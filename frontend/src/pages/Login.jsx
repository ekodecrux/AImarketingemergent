import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Sparkle, ArrowRight } from "@phosphor-icons/react";

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState("admin@zeromark.ai");
    const [password, setPassword] = useState("admin123");
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
        <div className="min-h-screen grid lg:grid-cols-2 bg-white">
            {/* Left brand panel */}
            <div className="hidden lg:flex flex-col justify-between p-12 bg-[#09090B] text-white relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: "url(https://images.unsplash.com/photo-1765408217205-1c42d81f1677?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                />
                <div className="relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-white flex items-center justify-center">
                            <Sparkle size={18} weight="fill" className="text-[#002EB8]" />
                        </div>
                        <span className="font-display text-2xl font-black tracking-tighter">ZEROMARK</span>
                    </div>
                </div>
                <div className="relative z-10 max-w-md">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-4">// AI marketing engine</p>
                    <h2 className="font-display text-5xl font-black tracking-tighter leading-[1.05] mb-6">
                        Find leads.<br/>Generate copy.<br/>Send. Convert.
                    </h2>
                    <p className="text-base text-white/70 leading-relaxed">
                        Plug in your business once. ZeroMark scrapes leads, drafts AI-approved campaigns
                        across email, SMS and social, then routes everything through a strict approval queue.
                    </p>
                </div>
                <div className="relative z-10 text-[10px] uppercase tracking-[0.3em] text-white/50">
                    PRECISION B2B GROWTH
                </div>
            </div>

            {/* Right form panel */}
            <div className="flex items-center justify-center p-8 lg:p-12">
                <form onSubmit={handleSubmit} className="w-full max-w-sm" data-testid="login-form">
                    <p className="zm-section-label mb-3">// Sign in</p>
                    <h1 className="font-display text-4xl font-black tracking-tighter mb-2">Access the platform.</h1>
                    <p className="text-sm text-[#71717A] mb-8">
                        New here?{" "}
                        <Link to="/register" className="text-[#002EB8] font-semibold underline underline-offset-2" data-testid="link-register">
                            Create an account
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
                        {loading ? "Signing in..." : "Sign in"}
                        <ArrowRight size={16} weight="bold" />
                    </button>

                    <div className="mt-8 pt-6 border-t border-[#E4E4E7]">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#A1A1AA] mb-2">Demo credentials</p>
                        <p className="text-xs text-[#71717A] font-mono">admin@zeromark.ai / admin123</p>
                    </div>
                </form>
            </div>
        </div>
    );
}
