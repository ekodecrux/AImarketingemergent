import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Rocket, X, ArrowRight } from "@phosphor-icons/react";

const DISMISS_KEY = "zm.resume_banner_dismissed_until";

export default function ResumeOnboardingBanner() {
    const navigate = useNavigate();
    const [state, setState] = useState(null);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const dismissedUntil = parseInt(sessionStorage.getItem(DISMISS_KEY) || "0");
        if (dismissedUntil > Date.now()) { setHidden(true); return; }
        api.get("/onboarding/wizard-state").then((r) => setState(r.data)).catch(() => {});
    }, []);

    // Only show if user dismissed BUT didn't complete and still has undone steps
    if (hidden || !state) return null;
    if (state.completed) return null;
    if (!state.dismissed) return null;
    if (state.completed_count >= state.total_steps) return null;

    const dismiss = () => {
        sessionStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000)); // 24h
        setHidden(true);
    };

    const resume = async () => {
        // Re-open the wizard by clearing the dismiss flag on the backend
        try {
            await api.post("/onboarding/wizard-resume");
        } catch {
            /* if endpoint doesn't exist, just navigate to next step */
        }
        const map = {
            profile: "/business",
            channel: "/connect",
            plan: "/growth?tab=quick",
            first_post: "/content",
        };
        navigate(map[state.next_step] || "/business");
    };

    const remaining = state.total_steps - state.completed_count;

    return (
        <div className="zm-card p-4 mb-4 border-l-4 border-[#2563EB] bg-gradient-to-r from-[#DBEAFE] to-white flex items-start justify-between gap-3" data-testid="resume-banner">
            <div className="flex items-start gap-3">
                <Rocket size={20} weight="fill" className="text-[#2563EB] mt-0.5" />
                <div>
                    <p className="font-bold text-[#0F172A] text-sm">Pick up where you left off · {remaining} step{remaining > 1 ? "s" : ""} to go</p>
                    <p className="text-xs text-[#475569] mt-0.5">
                        Your setup is {state.completed_count}/{state.total_steps} done — finish in 2 minutes and start getting your first leads automatically.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <button onClick={resume} className="zm-btn-primary text-xs py-1.5" data-testid="resume-banner-resume">
                    Resume <ArrowRight size={12} weight="bold" />
                </button>
                <button onClick={dismiss} className="text-[#64748B] hover:text-[#0F172A] p-1" data-testid="resume-banner-dismiss" aria-label="Hide for 24h">
                    <X size={14} weight="bold" />
                </button>
            </div>
        </div>
    );
}
