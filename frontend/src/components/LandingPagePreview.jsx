import { useState } from "react";
import {
    Lightning, Shield, Sparkle, Target, Rocket, ChartBar, ArrowRight, Quotes,
} from "@phosphor-icons/react";

const ICONS = { lightning: Lightning, shield: Shield, sparkle: Sparkle, target: Target, rocket: Rocket, chart: ChartBar };

export default function LandingPagePreview({ page, activeIdx, onActivate, isPublic = false, onSubmit }) {
    const primary = page.theme?.primary_color || "#002EB8";
    return (
        <div style={{ "--brand": primary }}>
            {page.sections.map((s, i) => {
                const interactive = !isPublic && onActivate;
                const wrapClass = interactive
                    ? `cursor-pointer transition-all ${activeIdx === i ? "ring-2 ring-[#002EB8] ring-inset" : "hover:ring-1 hover:ring-[#A1A1AA] hover:ring-inset"}`
                    : "";
                return (
                    <div key={i} onClick={interactive ? () => onActivate(i) : undefined} className={wrapClass}>
                        <SectionRender section={s} primary={primary} onSubmit={onSubmit} isPublic={isPublic} />
                    </div>
                );
            })}
        </div>
    );
}

function SectionRender({ section, primary, onSubmit, isPublic }) {
    switch (section.type) {
        case "hero":
            return (
                <section className="px-8 py-20 md:py-28 text-center relative overflow-hidden" style={{ background: section.background_image ? "" : "#F4F4F5" }}>
                    {section.background_image && (
                        <div className="absolute inset-0 opacity-30 z-0" style={{ backgroundImage: `url(${section.background_image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    )}
                    <div className="relative z-10 max-w-3xl mx-auto">
                        <h1 className="font-display text-4xl md:text-6xl font-black tracking-tighter leading-[1.05] mb-5">{section.headline}</h1>
                        <p className="text-lg text-[#52525B] mb-8">{section.subheadline}</p>
                        {section.cta_text && (
                            <a href={section.cta_link || "#form"} className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-sm" style={{ background: primary }}>
                                {section.cta_text} <ArrowRight size={14} weight="bold" />
                            </a>
                        )}
                    </div>
                </section>
            );

        case "features": {
            return (
                <section className="px-8 py-16 md:py-20 bg-white">
                    <div className="max-w-5xl mx-auto">
                        {section.heading && <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight text-center mb-12">{section.heading}</h2>}
                        <div className="grid md:grid-cols-3 gap-6">
                            {(section.items || []).map((it, i) => {
                                const Ic = ICONS[it.icon] || Sparkle;
                                return (
                                    <div key={i} className="text-center p-6 border border-[#E4E4E7] rounded-sm">
                                        <div className="w-10 h-10 mx-auto mb-3 flex items-center justify-center rounded-sm" style={{ background: primary }}>
                                            <Ic size={20} weight="fill" className="text-white" />
                                        </div>
                                        <h3 className="font-display text-lg font-bold tracking-tight mb-2">{it.title}</h3>
                                        <p className="text-sm text-[#71717A]">{it.desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            );
        }

        case "image_text":
            return (
                <section className="px-8 py-16 md:py-20 bg-[#F4F4F5]">
                    <div className={`max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center ${section.position === "left" ? "md:[direction:rtl]" : ""}`}>
                        <div className="md:[direction:ltr]">
                            <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight mb-4">{section.heading}</h2>
                            <p className="text-base text-[#52525B] leading-relaxed whitespace-pre-wrap">{section.body}</p>
                        </div>
                        <div className="md:[direction:ltr] aspect-[4/3] bg-white border border-[#E4E4E7] rounded-sm overflow-hidden">
                            {section.image ? (
                                <img src={section.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[#A1A1AA] text-xs uppercase tracking-[0.15em]">Image placeholder</div>
                            )}
                        </div>
                    </div>
                </section>
            );

        case "testimonial":
            return (
                <section className="px-8 py-16 md:py-20 text-white" style={{ background: "#09090B" }}>
                    <div className="max-w-3xl mx-auto text-center">
                        <Quotes size={32} weight="fill" className="mx-auto mb-6" style={{ color: primary }} />
                        <p className="font-display text-2xl md:text-3xl font-bold tracking-tight leading-snug mb-8">"{section.quote}"</p>
                        <p className="text-sm font-semibold">{section.author}</p>
                        <p className="text-xs uppercase tracking-[0.15em] text-white/60 font-semibold mt-1">{section.role}{section.company && ` · ${section.company}`}</p>
                    </div>
                </section>
            );

        case "cta":
            return (
                <section className="px-8 py-20 text-center" style={{ background: primary, color: "white" }}>
                    <h2 className="font-display text-3xl md:text-5xl font-black tracking-tighter mb-4 max-w-3xl mx-auto leading-tight">{section.heading}</h2>
                    <p className="text-base md:text-lg text-white/80 mb-8 max-w-xl mx-auto">{section.subheading}</p>
                    {section.cta_text && (
                        <a href={section.cta_link || "#form"} className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-white text-[#09090B] rounded-sm hover:bg-[#F4F4F5]">
                            {section.cta_text} <ArrowRight size={14} weight="bold" />
                        </a>
                    )}
                </section>
            );

        case "faq":
            return (
                <section className="px-8 py-16 md:py-20 bg-white">
                    <div className="max-w-3xl mx-auto">
                        <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight text-center mb-10">{section.heading}</h2>
                        <div className="divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-sm">
                            {(section.items || []).map((it, i) => (
                                <details key={i} className="p-5">
                                    <summary className="cursor-pointer font-semibold text-base">{it.q}</summary>
                                    <p className="text-sm text-[#71717A] mt-3 leading-relaxed">{it.a}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>
            );

        case "form":
            return <FormSection section={section} primary={primary} onSubmit={onSubmit} isPublic={isPublic} />;

        default:
            return <div className="p-8 bg-[#F4F4F5] text-xs text-[#71717A]">Unknown section: {section.type}</div>;
    }
}

function FormSection({ section, primary, onSubmit, isPublic }) {
    const [data, setData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!isPublic || !onSubmit) return;
        setSubmitting(true);
        try {
            await onSubmit(data);
            setDone(true);
        } catch (err) {
            // handled in parent
        } finally { setSubmitting(false); }
    };

    return (
        <section id="form" className="px-8 py-16 md:py-20 bg-[#F4F4F5]">
            <div className="max-w-md mx-auto bg-white border border-[#E4E4E7] p-8 rounded-sm">
                <h2 className="font-display text-2xl md:text-3xl font-black tracking-tight mb-2">{section.heading}</h2>
                {section.subheading && <p className="text-sm text-[#71717A] mb-6">{section.subheading}</p>}

                {done ? (
                    <div className="py-8 text-center">
                        <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full" style={{ background: primary }}>
                            <Sparkle size={20} weight="fill" className="text-white" />
                        </div>
                        <p className="font-semibold text-base">{section.success_message || "Thanks!"}</p>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-3" data-testid="public-form">
                        {(section.fields || []).map((f) => f === "message" ? (
                            <textarea key={f} rows={4} placeholder="Your message" value={data[f] || ""} onChange={(e) => setData({ ...data, [f]: e.target.value })} className="zm-input" data-testid={`form-${f}`} />
                        ) : (
                            <input key={f} type={f === "email" ? "email" : "text"} placeholder={f.charAt(0).toUpperCase() + f.slice(1)} value={data[f] || ""} onChange={(e) => setData({ ...data, [f]: e.target.value })} className="zm-input" data-testid={`form-${f}`} />
                        ))}
                        <button disabled={submitting || !isPublic} className="w-full px-4 py-2.5 text-sm font-semibold text-white rounded-sm" style={{ background: primary }} data-testid="form-submit">
                            {submitting ? "Sending…" : (section.submit_text || "Submit")}
                        </button>
                        {!isPublic && <p className="text-[10px] uppercase tracking-[0.15em] text-[#A1A1AA] text-center pt-2">Form preview · publish to capture leads</p>}
                    </form>
                )}
            </div>
        </section>
    );
}
