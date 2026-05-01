import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
    X, ArrowRight, ArrowLeft, CheckCircle, Sparkle, Briefcase, Plugs,
    Lightning, PaperPlaneTilt, Rocket, Confetti, LinkedinLogo, TwitterLogo, FacebookLogo,
} from "@phosphor-icons/react";

const STEPS = [
    { id: "profile", label: "Business profile", icon: Briefcase, est: "60 sec" },
    { id: "channel", label: "Connect a channel", icon: Plugs, est: "30 sec" },
    { id: "plan", label: "Generate plan", icon: Lightning, est: "20 sec" },
    { id: "first_post", label: "Schedule first post", icon: PaperPlaneTilt, est: "30 sec" },
];

export default function OnboardingWizard() {
    const navigate = useNavigate();
    const [state, setState] = useState(null);
    const [open, setOpen] = useState(false);
    const [stepIdx, setStepIdx] = useState(0);
    const [busy, setBusy] = useState(false);

    // Step 1: profile fields
    const [profile, setProfile] = useState({ business_name: "", industry: "", target_audience: "", website_url: "" });
    // Step 3: quick-plan fields
    const [budget, setBudget] = useState(5000);
    const [duration, setDuration] = useState(6);
    const [planResult, setPlanResult] = useState(null);

    // Initial load
    useEffect(() => {
        (async () => {
            try {
                const [w, b] = await Promise.all([
                    api.get("/onboarding/wizard-state"),
                    api.get("/business").catch(() => ({ data: {} })),
                ]);
                setState(w.data);
                if (b.data?.profile) {
                    setProfile((p) => ({ ...p, ...b.data.profile }));
                }
                if (w.data.show_wizard) {
                    setOpen(true);
                    // auto-jump to next undone step
                    const nextIdx = STEPS.findIndex((s) => s.id === w.data.next_step);
                    if (nextIdx >= 0) setStepIdx(nextIdx);
                }
            } catch {
                /* swallow */
            }
        })();
    }, []);

    const refreshState = async () => {
        try {
            const r = await api.get("/onboarding/wizard-state");
            setState(r.data);
            return r.data;
        } catch { return null; }
    };

    const dismiss = async () => {
        await api.post("/onboarding/wizard-dismiss");
        setOpen(false);
        toast.info("Onboarding hidden — find it again under the chatbot 'Getting started'.");
    };

    const finish = async () => {
        await api.post("/onboarding/wizard-complete");
        setOpen(false);
        toast.success("🎉 You're all set up — your first post is queued.");
    };

    const next = () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
    const back = () => setStepIdx((i) => Math.max(0, i - 1));

    // Step 1 — Save profile
    const saveProfile = async () => {
        if (!profile.business_name || !profile.industry || !profile.target_audience) {
            toast.error("Fill name, industry and target audience to continue");
            return;
        }
        setBusy(true);
        try {
            await api.post("/business", profile);
            toast.success("Profile saved · plan modules regenerating in background");
            await refreshState();
            next();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Save failed");
        } finally {
            setBusy(false);
        }
    };

    // Step 2 — Channel connect (deep-link out)
    const goConnect = () => {
        setOpen(false);
        navigate("/connect");
    };

    // Step 3 — Quick plan
    const generatePlan = async () => {
        setBusy(true);
        try {
            const r = await api.post("/quick-plan/generate", {
                monthly_budget: budget,
                duration_months: duration,
            });
            setPlanResult(r.data?.plan || r.data);
            toast.success("Plan ready");
            await refreshState();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Plan generation failed");
        } finally {
            setBusy(false);
        }
    };

    // Step 4 — Generate + auto-schedule first post
    const scheduleFirstPost = async () => {
        setBusy(true);
        try {
            // Pick best available platform: prefer LinkedIn → Twitter → blog
            const integ = await api.get("/integrations/health").then((r) => r.data.channels || {});
            const platforms = ["linkedin", "twitter", "facebook"].filter((p) => integ[p]?.healthy);
            if (platforms.length === 0) platforms.push("blog");

            // Generate a content kit
            const kit = await api.post("/content/generate", {
                topic: profile.industry ? `Why ${profile.industry} brands are betting on AI marketing in 2026` : "How to scale lead generation with AI",
            });
            const contentId = kit.data?.content?.id;
            if (!contentId) throw new Error("Content generation didn't return an id");

            // Schedule for 30 min from now
            const when = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            await api.post("/schedule", {
                content_id: contentId,
                scheduled_at: when,
                platforms,
            });
            toast.success(`First post scheduled for ${new Date(when).toLocaleTimeString()}`);
            await refreshState();
            await finish();
        } catch (e) {
            toast.error(e.response?.data?.detail || e.message || "Couldn't schedule first post");
        } finally {
            setBusy(false);
        }
    };

    if (!open || !state) return null;

    const current = STEPS[stepIdx];
    const completedCount = state.completed_count || 0;

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" data-testid="onboarding-wizard">
            <div className="bg-white rounded-md shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto border border-[#E2E8F0]">
                {/* Header */}
                <div className="bg-[#0F172A] text-white p-6 sticky top-0 z-10">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold flex items-center gap-1.5">
                                <Rocket size={11} weight="fill" /> // First-time setup · ~3 min
                            </p>
                            <h2 className="font-display text-2xl font-black tracking-tighter mt-1">Let's get your first lead in under 5 minutes.</h2>
                        </div>
                        <button onClick={dismiss} className="text-white/50 hover:text-white p-1" data-testid="wizard-close" aria-label="Skip onboarding">
                            <X size={20} weight="bold" />
                        </button>
                    </div>
                    {/* Progress */}
                    <div className="mt-5 flex items-center gap-1">
                        {STEPS.map((s, i) => {
                            const done = state.step_done?.[s.id];
                            const active = i === stepIdx;
                            return (
                                <div
                                    key={s.id}
                                    className="flex-1 h-1.5 rounded-full transition-all"
                                    style={{ background: done ? "#10B981" : active ? "#FFFFFF" : "rgba(255,255,255,0.2)" }}
                                />
                            );
                        })}
                    </div>
                    <p className="text-[11px] text-white/60 mt-2">{completedCount}/{STEPS.length} done · current step: <strong className="text-white">{current.label}</strong> ({current.est})</p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4" data-testid={`wizard-step-${current.id}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-sm bg-[#DBEAFE] flex items-center justify-center">
                            <current.icon size={20} weight="bold" className="text-[#1D4ED8]" />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-[#71717A] font-bold">// Step {stepIdx + 1} of {STEPS.length}</p>
                            <h3 className="font-display text-xl font-bold tracking-tight">{current.label}</h3>
                        </div>
                    </div>

                    {current.id === "profile" && (
                        <div className="space-y-3">
                            <p className="text-sm text-[#71717A]">Tell us about your business — every AI prompt downstream is built from this.</p>
                            <div>
                                <label className="zm-label">Business name *</label>
                                <input className="zm-input" value={profile.business_name} onChange={(e) => setProfile({ ...profile, business_name: e.target.value })} placeholder="Acme Corp" data-testid="wizard-business-name" />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="zm-label">Industry *</label>
                                    <input className="zm-input" value={profile.industry} onChange={(e) => setProfile({ ...profile, industry: e.target.value })} placeholder="SaaS, D2C, Healthcare…" data-testid="wizard-industry" />
                                </div>
                                <div>
                                    <label className="zm-label">Website (optional)</label>
                                    <input className="zm-input" value={profile.website_url || ""} onChange={(e) => setProfile({ ...profile, website_url: e.target.value })} placeholder="https://yourcompany.com" data-testid="wizard-website" />
                                </div>
                            </div>
                            <div>
                                <label className="zm-label">Who do you sell to? *</label>
                                <textarea className="zm-input" rows={2} value={profile.target_audience} onChange={(e) => setProfile({ ...profile, target_audience: e.target.value })} placeholder="VP Marketing at B2B SaaS · 20-200 employees · India/SEA" data-testid="wizard-audience" />
                            </div>
                        </div>
                    )}

                    {current.id === "channel" && (
                        <div className="space-y-3">
                            <p className="text-sm text-[#71717A]">
                                Connect at least one social channel so your scheduled posts can go out for real. 30-second OAuth — no copy-paste of tokens.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { id: "linkedin", icon: LinkedinLogo, label: "LinkedIn", color: "#0A66C2" },
                                    { id: "twitter", icon: TwitterLogo, label: "X", color: "#0F172A" },
                                    { id: "facebook", icon: FacebookLogo, label: "Facebook", color: "#1877F2" },
                                ].map((c) => (
                                    <span key={c.id} className="zm-badge text-xs px-3 py-1.5" style={{ background: c.color, color: "#fff" }}>
                                        <c.icon size={11} weight="fill" /> {c.label}
                                    </span>
                                ))}
                            </div>
                            <div className="zm-card p-4 bg-[#FFFBEB] border-l-4 border-[#F59E0B]">
                                <p className="text-xs text-[#92400E] leading-relaxed">
                                    <strong>Heads up:</strong> If your platform admin hasn't registered the Developer Apps yet, you'll see "Awaiting platform setup" badges. You can still skip this step and come back later — your scheduled posts will queue up safely.
                                </p>
                            </div>
                            {state.step_done?.channel ? (
                                <p className="text-sm text-[#10B981] flex items-center gap-1.5">
                                    <CheckCircle size={14} weight="fill" /> You've connected at least one channel · ready to publish
                                </p>
                            ) : (
                                <button onClick={goConnect} className="zm-btn-primary" data-testid="wizard-go-connect">
                                    <Plugs size={14} weight="bold" /> Open Connect Channels
                                </button>
                            )}
                        </div>
                    )}

                    {current.id === "plan" && (
                        <div className="space-y-3">
                            <p className="text-sm text-[#71717A]">
                                ZeroMark builds a guaranteed-leads plan from your budget. Organic-first — paid only kicks in if math demands it.
                            </p>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="zm-label">Monthly budget (₹)</label>
                                    <input type="number" className="zm-input" value={budget} onChange={(e) => setBudget(parseInt(e.target.value || "0"))} min={1000} step={500} data-testid="wizard-budget" />
                                </div>
                                <div>
                                    <label className="zm-label">Duration</label>
                                    <select className="zm-input" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} data-testid="wizard-duration">
                                        <option value={3}>3 months</option>
                                        <option value={6}>6 months</option>
                                        <option value={9}>9 months</option>
                                        <option value={12}>12 months</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={generatePlan} disabled={busy} className="zm-btn-primary" data-testid="wizard-generate-plan">
                                <Sparkle size={14} weight="fill" /> {busy ? "Generating…" : "Generate guaranteed plan"}
                            </button>
                            {planResult && (
                                <div className="zm-card p-4 bg-[#F0FDF4] border-l-4 border-[#10B981] text-sm space-y-1">
                                    <p className="font-bold text-[#065F46]">Plan ready ✓</p>
                                    {planResult.guaranteed_leads_per_month && (
                                        <p>· <strong>{planResult.guaranteed_leads_per_month}</strong> guaranteed leads/month</p>
                                    )}
                                    {planResult.total_guaranteed_leads && (
                                        <p>· <strong>{planResult.total_guaranteed_leads}</strong> total guaranteed leads over {duration} months</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {current.id === "first_post" && (
                        <div className="space-y-3">
                            <p className="text-sm text-[#71717A]">
                                We'll generate a topical post about your industry, schedule it 30 minutes from now, and queue it on every connected channel.
                            </p>
                            <div className="zm-card p-4 bg-[#F8FAFC]">
                                <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-2">// Topic</p>
                                <p className="text-sm font-bold text-[#0F172A]">
                                    {profile.industry ? `Why ${profile.industry} brands are betting on AI marketing in 2026` : "How to scale lead generation with AI"}
                                </p>
                            </div>
                            <button onClick={scheduleFirstPost} disabled={busy} className="zm-btn-primary" data-testid="wizard-schedule-post">
                                <PaperPlaneTilt size={14} weight="bold" /> {busy ? "Generating + scheduling…" : "Generate & schedule first post"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-[#E2E8F0] p-4 flex items-center justify-between bg-[#F8FAFC] sticky bottom-0">
                    <button onClick={dismiss} className="text-xs text-[#71717A] hover:text-[#0F172A]" data-testid="wizard-skip-all">
                        Skip onboarding
                    </button>
                    <div className="flex items-center gap-2">
                        {stepIdx > 0 && (
                            <button onClick={back} className="zm-btn-secondary text-xs py-2" data-testid="wizard-back">
                                <ArrowLeft size={12} weight="bold" /> Back
                            </button>
                        )}
                        {current.id === "profile" && (
                            <button onClick={saveProfile} disabled={busy} className="zm-btn-primary text-xs py-2" data-testid="wizard-save-profile">
                                {busy ? "Saving…" : "Save & continue"} <ArrowRight size={12} weight="bold" />
                            </button>
                        )}
                        {current.id === "channel" && (
                            <button onClick={next} className="zm-btn-primary text-xs py-2" data-testid="wizard-channel-next">
                                {state.step_done?.channel ? "Continue" : "Skip for now"} <ArrowRight size={12} weight="bold" />
                            </button>
                        )}
                        {current.id === "plan" && (
                            <button onClick={next} disabled={!state.step_done?.plan && !planResult} className="zm-btn-primary text-xs py-2" data-testid="wizard-plan-next">
                                Continue <ArrowRight size={12} weight="bold" />
                            </button>
                        )}
                        {current.id === "first_post" && state.step_done?.first_post && (
                            <button onClick={finish} className="zm-btn-primary text-xs py-2" data-testid="wizard-finish">
                                <Confetti size={12} weight="fill" /> Finish
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
