import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import { Phone, ArrowRight, ArrowLeft } from "@phosphor-icons/react";

export default function SmsAuthForm({ mode = "login", onCancel }) {
    const navigate = useNavigate();
    const { setSession } = useAuth();
    const [step, setStep] = useState("phone"); // 'phone' | 'otp'
    const [phone, setPhone] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    const sendOtp = async (e) => {
        e?.preventDefault();
        if (!phone.startsWith("+")) {
            toast.error("Phone must start with country code, e.g. +1…");
            return;
        }
        setLoading(true);
        try {
            const r = await api.post("/auth/sms/send-otp", { phone });
            if (r.data.dev_otp) {
                toast.success(`Dev OTP: ${r.data.dev_otp}`, { duration: 8000 });
            } else {
                toast.success("OTP sent — check your SMS");
            }
            setStep("otp");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to send OTP");
        } finally { setLoading(false); }
    };

    const verifyOtp = async (e) => {
        e?.preventDefault();
        if (otp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
        setLoading(true);
        try {
            const r = await api.post("/auth/sms/verify-otp", {
                phone, otp,
                first_name: mode === "register" ? firstName : undefined,
                last_name: mode === "register" ? lastName : undefined,
            });
            setSession(r.data.token, r.data.user);
            toast.success(r.data.is_new ? "Account created — let's get started" : "Welcome back");
            navigate(r.data.is_new ? "/onboarding" : "/dashboard", { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.detail || "Invalid code");
        } finally { setLoading(false); }
    };

    return (
        <div data-testid="sms-auth-form">
            {step === "phone" && (
                <form onSubmit={sendOtp} className="space-y-3">
                    {mode === "register" && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="zm-label">First name</label>
                                <input className="zm-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required data-testid="sms-firstname" />
                            </div>
                            <div>
                                <label className="zm-label">Last name</label>
                                <input className="zm-input" value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="sms-lastname" />
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="zm-label">Phone (with country code)</label>
                        <div className="flex gap-2">
                            <span className="inline-flex items-center px-3 bg-[#F8FAFC] border border-r-0 border-[#E2E8F0] text-[#64748B] rounded-l-md">
                                <Phone size={14} weight="bold" />
                            </span>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+14155551234"
                                className="zm-input flex-1 rounded-l-none"
                                required
                                data-testid="sms-phone-input"
                            />
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-1">E.164 format · Standard SMS rates apply</p>
                    </div>
                    <button type="submit" disabled={loading} className="zm-btn-primary w-full" data-testid="sms-send-otp">
                        {loading ? "Sending OTP…" : "Send OTP"}
                        <ArrowRight size={14} weight="bold" />
                    </button>
                    {onCancel && (
                        <button type="button" onClick={onCancel} className="text-xs text-[#64748B] hover:text-[#0F172A] w-full text-center font-semibold pt-1" data-testid="sms-cancel">
                            Use another method
                        </button>
                    )}
                </form>
            )}

            {step === "otp" && (
                <form onSubmit={verifyOtp} className="space-y-3">
                    <p className="text-xs text-[#64748B]">
                        Enter the 6-digit code sent to <span className="font-mono text-[#0F172A]">{phone}</span>
                    </p>
                    <div>
                        <label className="zm-label">Verification code</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            pattern="[0-9]{6}"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            className="zm-input font-mono text-center text-2xl tracking-[0.4em]"
                            placeholder="000000"
                            autoFocus
                            data-testid="sms-otp-input"
                        />
                    </div>
                    <button type="submit" disabled={loading || otp.length !== 6} className="zm-btn-primary w-full" data-testid="sms-verify-otp">
                        {loading ? "Verifying…" : (mode === "register" ? "Create account" : "Sign in")}
                        <ArrowRight size={14} weight="bold" />
                    </button>
                    <button type="button" onClick={() => { setStep("phone"); setOtp(""); }} className="text-xs text-[#64748B] hover:text-[#0F172A] w-full text-center font-semibold pt-1 flex items-center justify-center gap-1" data-testid="sms-back">
                        <ArrowLeft size={12} weight="bold" /> Change phone number
                    </button>
                </form>
            )}
        </div>
    );
}
