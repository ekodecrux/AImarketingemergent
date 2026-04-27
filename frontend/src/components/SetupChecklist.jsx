import { Link } from "react-router-dom";
import { CheckCircle, Circle, Sparkle, ArrowRight, Rocket } from "@phosphor-icons/react";

export default function SetupChecklist({ setup }) {
    if (!setup) return null;
    const { steps, completed, total, percent, next_step } = setup;

    return (
        <div className="zm-card mb-6 overflow-hidden" data-testid="setup-checklist">
            {/* Hero header */}
            <div className="bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white p-7">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <Rocket size={16} weight="fill" />
                            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/80">Get to first lead</span>
                        </div>
                        <h2 className="font-display text-3xl font-black tracking-tight">Your growth engine setup</h2>
                        <p className="text-sm text-white/80 mt-1">{completed} of {total} steps complete · we'll guide you to {total - completed} remaining.</p>
                    </div>
                    {next_step && (
                        <Link
                            to={next_step.cta}
                            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-[#2563EB] rounded-md text-sm font-bold hover:bg-[#F8FAFC] transition-colors shadow-sm"
                            data-testid="setup-next-cta"
                        >
                            <Sparkle size={14} weight="fill" />
                            Next: {next_step.cta_label}
                            <ArrowRight size={14} weight="bold" />
                        </Link>
                    )}
                </div>
                {/* Progress bar */}
                <div className="mt-5">
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all" style={{ width: `${percent}%` }}></div>
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-white/70 mt-1.5">{percent}% complete</p>
                </div>
            </div>

            {/* Steps grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-7 divide-x divide-[#E2E8F0]">
                {steps.map((s, i) => {
                    const isNext = next_step && s.id === next_step.id;
                    return (
                        <Link
                            key={s.id}
                            to={s.cta}
                            className={`p-4 flex flex-col gap-2 transition-colors ${
                                s.done ? "bg-[#F8FAFC]" : isNext ? "bg-[#DBEAFE]/40 hover:bg-[#DBEAFE]/60" : "bg-white hover:bg-[#F8FAFC]"
                            }`}
                            data-testid={`setup-step-${s.id}`}
                        >
                            <div className="flex items-center gap-2">
                                {s.done ? (
                                    <CheckCircle size={18} weight="fill" className="text-[#10B981] shrink-0" />
                                ) : isNext ? (
                                    <span className="w-[18px] h-[18px] rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                ) : (
                                    <Circle size={18} weight="regular" className="text-[#CBD5E1] shrink-0" />
                                )}
                                <span className={`text-[11px] font-bold uppercase tracking-[0.06em] ${s.done ? "text-[#94A3B8] line-through" : isNext ? "text-[#2563EB]" : "text-[#64748B]"}`}>
                                    Step {i + 1}
                                </span>
                            </div>
                            <p className={`text-xs font-semibold leading-snug ${s.done ? "text-[#94A3B8] line-through" : "text-[#0F172A]"}`}>
                                {s.label}
                            </p>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
