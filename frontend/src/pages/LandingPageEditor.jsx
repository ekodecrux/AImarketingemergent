import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    ArrowLeft, Plus, Trash, ArrowUp, ArrowDown, Sparkle,
    Eye, FloppyDisk, ArrowSquareOut, X,
} from "@phosphor-icons/react";
import LandingPagePreview from "@/components/LandingPagePreview";

const SECTION_TYPES = [
    { id: "hero", label: "Hero" },
    { id: "features", label: "Features" },
    { id: "image_text", label: "Image + Text" },
    { id: "testimonial", label: "Testimonial" },
    { id: "faq", label: "FAQ" },
    { id: "form", label: "Lead Form" },
    { id: "cta", label: "CTA" },
];

export default function LandingPageEditor() {
    const { id } = useParams();
    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(null);
    const [activeIdx, setActiveIdx] = useState(0);
    const [showAdd, setShowAdd] = useState(false);

    const load = () => {
        setLoading(true);
        api.get(`/landing-pages/${id}`)
            .then((r) => setPage(r.data.page))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

    const save = async () => {
        setSaving(true);
        try {
            await api.put(`/landing-pages/${id}`, {
                title: page.title, slug: page.slug, sections: page.sections,
                published: page.published, theme: page.theme,
                seo_title: page.seo_title, seo_description: page.seo_description,
            });
            toast.success("Saved");
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Save failed");
        } finally { setSaving(false); }
    };

    const updateSection = (idx, patch) => {
        const sections = [...page.sections];
        sections[idx] = { ...sections[idx], ...patch };
        setPage({ ...page, sections });
    };

    const moveSection = (idx, dir) => {
        const sections = [...page.sections];
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= sections.length) return;
        [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
        setPage({ ...page, sections });
        setActiveIdx(newIdx);
    };

    const removeSection = (idx) => {
        const sections = page.sections.filter((_, i) => i !== idx);
        setPage({ ...page, sections });
        setActiveIdx(Math.min(activeIdx, sections.length - 1));
    };

    const addSection = (type) => {
        const defaults = DEFAULTS[type];
        setPage({ ...page, sections: [...page.sections, defaults] });
        setActiveIdx(page.sections.length);
        setShowAdd(false);
    };

    const aiGenerate = async (idx) => {
        setGenerating(idx);
        try {
            const r = await api.post(`/landing-pages/${id}/ai-generate-section`, {
                section_type: page.sections[idx].type,
                tone: "professional",
            });
            updateSection(idx, r.data.section);
            toast.success("Section generated");
        } catch (err) {
            toast.error(err.response?.data?.detail || "AI failed");
        } finally { setGenerating(null); }
    };

    const togglePublish = async () => {
        const nextPublished = !page.published;
        setPage({ ...page, published: nextPublished });
        try {
            await api.put(`/landing-pages/${id}`, {
                title: page.title, slug: page.slug, sections: page.sections,
                published: nextPublished, theme: page.theme,
            });
            toast.success(nextPublished ? "Published — page is live" : "Unpublished");
        } catch { toast.error("Failed"); }
    };

    if (loading || !page) return <div className="p-12 text-sm text-[#71717A]">Loading…</div>;

    const publicUrl = `${window.location.origin}/p/${page.slug}`;

    return (
        <div>
            <PageHeader
                eyebrow="// Page editor"
                title={page.title}
                subtitle={`/p/${page.slug} · ${page.sections.length} sections · ${page.view_count || 0} views · ${page.submission_count || 0} submissions`}
                action={
                    <div className="flex gap-2 flex-wrap">
                        <Link to="/landing-pages" className="zm-btn-secondary"><ArrowLeft size={14} weight="bold" /> Back</Link>
                        {page.published && (
                            <a href={publicUrl} target="_blank" rel="noreferrer" className="zm-btn-secondary" data-testid="view-live">
                                <ArrowSquareOut size={14} weight="bold" /> View live
                            </a>
                        )}
                        <button onClick={togglePublish} className={page.published ? "zm-btn-secondary" : "zm-btn-dark"} data-testid="toggle-publish">
                            {page.published ? "Unpublish" : "Publish"}
                        </button>
                        <button onClick={save} disabled={saving} className="zm-btn-primary" data-testid="save-page">
                            <FloppyDisk size={14} weight="bold" /> {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                }
            />
            <div className="px-8 py-6 grid lg:grid-cols-[300px_1fr_360px] gap-6">
                {/* LEFT: Section list */}
                <div className="space-y-3">
                    <div className="zm-card p-3">
                        <p className="zm-section-label mb-2 px-2">// Page settings</p>
                        <input className="zm-input mb-2" value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} placeholder="Page title" data-testid="page-title-input" />
                        <input className="zm-input mb-2 font-mono text-xs" value={page.slug} onChange={(e) => setPage({ ...page, slug: e.target.value })} placeholder="url-slug" data-testid="page-slug-input" />
                        <input type="color" value={page.theme?.primary_color || "#2563EB"} onChange={(e) => setPage({ ...page, theme: { ...page.theme, primary_color: e.target.value } })} className="w-full h-9 cursor-pointer" data-testid="page-color" />
                    </div>

                    <div className="zm-card">
                        <div className="flex items-center justify-between p-3 border-b border-[#E2E8F0]">
                            <p className="zm-section-label">// Sections</p>
                            <button onClick={() => setShowAdd(!showAdd)} className="text-xs uppercase tracking-[0.1em] font-bold text-[#2563EB] hover:underline flex items-center gap-1" data-testid="add-section">
                                <Plus size={11} weight="bold" /> Add
                            </button>
                        </div>
                        {showAdd && (
                            <div className="p-3 border-b border-[#E2E8F0] bg-[#F8FAFC] grid grid-cols-2 gap-1.5" data-testid="section-type-picker">
                                {SECTION_TYPES.map((t) => (
                                    <button key={t.id} onClick={() => addSection(t.id)} className="px-2 py-1.5 text-xs bg-white border border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB] uppercase tracking-[0.05em] font-bold" data-testid={`add-${t.id}`}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div data-testid="sections-list">
                            {page.sections.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveIdx(i)}
                                    data-testid={`section-${i}`}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm border-b border-[#E2E8F0] last:border-b-0 ${
                                        activeIdx === i ? "bg-[#0F172A] text-white" : "bg-white hover:bg-[#F8FAFC]"
                                    }`}
                                >
                                    <span className="font-mono text-[10px] opacity-60 w-5">{String(i + 1).padStart(2, "0")}</span>
                                    <span className="flex-1 capitalize">{s.type.replace("_", " ")}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* CENTER: Live preview */}
                <div className="zm-card overflow-hidden">
                    <div className="bg-[#F8FAFC] px-4 py-2 border-b border-[#E2E8F0] flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#E32636]"></span>
                        <span className="w-2 h-2 rounded-full bg-[#F59E0B]"></span>
                        <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                        <span className="ml-2 text-xs font-mono text-[#71717A]">/p/{page.slug}</span>
                    </div>
                    <div className="max-h-[800px] overflow-y-auto bg-white">
                        <LandingPagePreview page={page} activeIdx={activeIdx} onActivate={setActiveIdx} />
                    </div>
                </div>

                {/* RIGHT: Section editor */}
                <div>
                    {page.sections[activeIdx] ? (
                        <SectionEditor
                            section={page.sections[activeIdx]}
                            onUpdate={(patch) => updateSection(activeIdx, patch)}
                            onMove={(dir) => moveSection(activeIdx, dir)}
                            onRemove={() => removeSection(activeIdx)}
                            onAIGenerate={() => aiGenerate(activeIdx)}
                            generating={generating === activeIdx}
                            canMoveUp={activeIdx > 0}
                            canMoveDown={activeIdx < page.sections.length - 1}
                        />
                    ) : (
                        <p className="zm-card p-8 text-sm text-[#A1A1AA] text-center">No section selected</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function SectionEditor({ section, onUpdate, onMove, onRemove, onAIGenerate, generating, canMoveUp, canMoveDown }) {
    return (
        <div className="zm-card sticky top-6">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <p className="zm-section-label capitalize">// {section.type.replace("_", " ")}</p>
                <div className="flex gap-1">
                    <button onClick={() => onMove(-1)} disabled={!canMoveUp} className="p-1.5 hover:bg-[#F8FAFC] disabled:opacity-30" data-testid="section-up">
                        <ArrowUp size={12} weight="bold" />
                    </button>
                    <button onClick={() => onMove(1)} disabled={!canMoveDown} className="p-1.5 hover:bg-[#F8FAFC] disabled:opacity-30" data-testid="section-down">
                        <ArrowDown size={12} weight="bold" />
                    </button>
                    <button onClick={onRemove} className="p-1.5 hover:bg-[#FEE2E2] hover:text-[#E32636]" data-testid="section-remove">
                        <Trash size={12} weight="bold" />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-3">
                <button onClick={onAIGenerate} disabled={generating} className="zm-btn-dark w-full text-xs py-2" data-testid="section-ai-gen">
                    <Sparkle size={12} weight="fill" /> {generating ? "Generating…" : "Generate with AI"}
                </button>

                {/* Common single-string fields */}
                {["headline", "subheadline", "heading", "subheading", "quote", "author", "role", "company",
                  "cta_text", "cta_link", "background_image", "image", "submit_text", "success_message",
                  "body"].map((k) =>
                    section[k] !== undefined ? (
                        <div key={k}>
                            <label className="zm-label">{k.replace(/_/g, " ")}</label>
                            {k === "body" || k === "success_message" || k === "subheadline" || k === "subheading" || k === "quote" ? (
                                <textarea rows={3} className="zm-input" value={section[k]} onChange={(e) => onUpdate({ [k]: e.target.value })} data-testid={`field-${k}`} />
                            ) : (
                                <input className="zm-input" value={section[k] || ""} onChange={(e) => onUpdate({ [k]: e.target.value })} data-testid={`field-${k}`} />
                            )}
                        </div>
                    ) : null,
                )}

                {/* Position selector for image_text */}
                {section.position !== undefined && (
                    <div>
                        <label className="zm-label">Image position</label>
                        <select value={section.position} onChange={(e) => onUpdate({ position: e.target.value })} className="zm-input" data-testid="field-position">
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                )}

                {/* Items array editor (features / faq) */}
                {Array.isArray(section.items) && (
                    <div>
                        <label className="zm-label">Items</label>
                        <div className="space-y-2">
                            {section.items.map((it, i) => (
                                <div key={i} className="bg-[#F8FAFC] p-3 space-y-2 relative">
                                    <button onClick={() => onUpdate({ items: section.items.filter((_, j) => j !== i) })} className="absolute top-1.5 right-1.5 text-[#71717A] hover:text-[#E32636]"><X size={12} weight="bold" /></button>
                                    {Object.keys(it).map((k) => (
                                        <input key={k} className="zm-input text-xs" placeholder={k} value={it[k] || ""} onChange={(e) => {
                                            const items = [...section.items];
                                            items[i] = { ...items[i], [k]: e.target.value };
                                            onUpdate({ items });
                                        }} />
                                    ))}
                                </div>
                            ))}
                            <button onClick={() => {
                                const template = section.type === "features" ? { title: "", desc: "", icon: "sparkle" }
                                    : section.type === "faq" ? { q: "", a: "" } : {};
                                onUpdate({ items: [...section.items, template] });
                            }} className="zm-btn-secondary w-full text-xs py-2" data-testid="add-item">
                                <Plus size={11} weight="bold" /> Add item
                            </button>
                        </div>
                    </div>
                )}

                {/* Form fields editor */}
                {Array.isArray(section.fields) && (
                    <div>
                        <label className="zm-label">Form fields</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {["name", "email", "phone", "company", "message"].map((f) => {
                                const on = section.fields.includes(f);
                                return (
                                    <button
                                        key={f}
                                        onClick={() => onUpdate({
                                            fields: on ? section.fields.filter((x) => x !== f) : [...section.fields, f]
                                        })}
                                        className={`px-2 py-1.5 text-xs uppercase tracking-[0.05em] font-bold border ${on ? "bg-[#2563EB] border-[#2563EB] text-white" : "bg-white border-[#E2E8F0] text-[#71717A]"}`}
                                        data-testid={`field-toggle-${f}`}
                                    >
                                        {f}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const DEFAULTS = {
    hero: { type: "hero", headline: "Your headline", subheadline: "Subheadline", cta_text: "Get started", cta_link: "#form", background_image: "" },
    features: { type: "features", heading: "Why us", items: [{ title: "Fast", desc: "Description.", icon: "lightning" }, { title: "Reliable", desc: "Description.", icon: "shield" }, { title: "Simple", desc: "Description.", icon: "sparkle" }] },
    testimonial: { type: "testimonial", quote: "Great product!", author: "Jane", role: "Founder", company: "Acme" },
    cta: { type: "cta", heading: "Ready?", subheading: "Join us.", cta_text: "Start", cta_link: "#form" },
    form: { type: "form", heading: "Get in touch", subheading: "We respond within 24h.", fields: ["name", "email", "message"], submit_text: "Submit", success_message: "Thanks!" },
    faq: { type: "faq", heading: "FAQ", items: [{ q: "Question?", a: "Answer." }] },
    image_text: { type: "image_text", heading: "Heading", body: "Body text.", image: "", position: "right" },
};
