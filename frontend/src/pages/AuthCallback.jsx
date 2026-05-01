import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Sparkle } from "@phosphor-icons/react";

/**
 * Handles Google OAuth return from Emergent Auth.
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH.
 */
export default function AuthCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { setSession } = useAuth();
    const [error, setError] = useState(null);
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const hash = location.hash || window.location.hash || "";
        const m = hash.match(/session_id=([^&]+)/);
        if (!m) {
            setError("No session id in URL");
            return;
        }
        const session_id = decodeURIComponent(m[1]);

        api.post("/auth/google/callback", { session_id })
            .then((r) => {
                setSession(r.data.token, r.data.user);
                // Clear the hash so re-renders don't re-trigger
                window.history.replaceState(null, "", window.location.pathname);
                navigate(r.data.is_new ? "/onboarding" : "/dashboard", { replace: true });
            })
            .catch((err) => {
                const status = err.response?.status;
                const detail = err.response?.data?.detail;
                // 403 from our stricter Google sign-in policy — friendlier copy
                if (status === 403) {
                    setError(detail || "No ZeroMark account found for this Google email. Please register first, then sign in with Google using the same email.");
                } else {
                    setError(detail || "Authentication failed");
                }
            });
    }, [location.hash, navigate, setSession]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
            <div className="text-center max-w-sm">
                <div className="w-12 h-12 bg-[#0F172A] rounded-md flex items-center justify-center mx-auto mb-4">
                    <Sparkle size={20} weight="fill" className="text-[#2563EB] animate-pulse" />
                </div>
                {error ? (
                    <>
                        <h2 className="font-display text-xl font-bold mb-2">Sign in failed</h2>
                        <p className="text-sm text-[#64748B] mb-4">{error}</p>
                        <button onClick={() => navigate("/login")} className="zm-btn-primary">Back to login</button>
                    </>
                ) : (
                    <>
                        <h2 className="font-display text-xl font-bold mb-2">Signing you in…</h2>
                        <p className="text-sm text-[#64748B]">This will only take a second.</p>
                    </>
                )}
            </div>
        </div>
    );
}
