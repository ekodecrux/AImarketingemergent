import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import ABTester from "@/components/ABTester";
import {
    Sparkle, Article, Hash, ShareNetwork, Clipboard, CheckCircle,
    Code, ArrowRight, Trash, MagnifyingGlass,
} from "@phosphor-icons/react";

export default function Content() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [topic, setTopic] = useState("");
    const [active, setActive] = useState(null);

    const load = () => {
        setLoading(true);
        api.get("/content").then((r) => setItems(r.data.content || []))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const generate = async () => {
        setGenerating(true);
        const t = toast.loading("Generating content kit (blog + meta + social + SEO)…");
        try {
            const r = await api.post("/content/generate", { topic: topic || undefined });
            toast.success("Content kit ready", { id: t });
            setTopic("");
            setActive(r.data.content);
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Generation failed", { id: t });
        } finally { setGenerating(false); }
    };

    const publish = async (id) => {
        await api.put(`/content/${id}/status`, { status: "PUBLISHED" });
        toast.success("Marked as published");
        load();
        if (active?.id === id) {
            const r = await api.get(`/content/${id}`);
            setActive(r.data.content);
        }
    };

    const remove = async (id) => {
        if (!window.confirm("Delete this content kit?")) return;
        await api.delete(`/content/${id}`);
        if (active?.id === id) setActive(null);
        toast.success("Deleted");
        load();
    };

    return (
        <div data-testid="content-page">
            <PageHeader
                eyebrow="// Content Studio"
                title="Daily SEO + Social Kit"
                subtitle="One-click generation of a blog post, meta tags, JSON-LD schema, social posts, and SEO keywords — country-aware."
                action={
                    <div className="flex gap-2">
                        <input
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Topic (optional — AI picks)"
                            className="zm-input w-64"
                            data-testid="content-topic-input"
                        />
                        <button onClick={generate} disabled={generating} className="zm-btn-primary" data-testid="content-generate-btn">
                            <Sparkle size={14} weight="fill" />
                            {generating ? "Generating…" : "Generate kit"}
                        </button>
                    </div>
                }
            />

            <div className="px-4 sm:px-6 lg:px-8 py-6 grid lg:grid-cols-[300px_1fr] gap-6">
                {/* List sidebar */}
                <div className="zm-card overflow-hidden h-fit" data-testid="content-list">
                    <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <p className="zm-section-label">// Library · {items.length}</p>
                    </div>
                    {loading ? (
                        <p className="p-8 text-center text-sm text-[#94A3B8]">Loading…</p>
                    ) : items.length === 0 ? (
                        <div className="p-8 text-center">
                            <Article size={24} className="mx-auto mb-3 text-[#94A3B8]" />
                            <p className="text-sm text-[#64748B] mb-3">No content yet.</p>
                            <p className="text-xs text-[#94A3B8]">Click "Generate kit" to create your first.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[#E2E8F0] max-h-[600px] overflow-y-auto">
                            {items.map((it) => (
                                <button
                                    key={it.id}
                                    onClick={() => setActive(it)}
                                    className={`w-full text-left px-4 py-3 hover:bg-[#F8FAFC] transition-colors ${active?.id === it.id ? "bg-[#DBEAFE]/40" : ""}`}
                                    data-testid={`content-item-${it.id}`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-sm font-bold leading-tight line-clamp-2">{it.kit?.blog_post?.title || it.topic || "Untitled"}</p>
                                        <span className={`zm-badge shrink-0 ${
                                            it.status === "PUBLISHED" ? "bg-[#10B981] text-white" :
                                            it.status === "SCHEDULED" ? "bg-[#F59E0B] text-white" :
                                            it.status === "ARCHIVED" ? "bg-[#94A3B8] text-white" :
                                            "bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0]"
                                        }`}>{it.status}</span>
                                    </div>
                                    <p className="text-[10px] uppercase tracking-[0.1em] text-[#94A3B8] font-bold">
                                        {new Date(it.generated_at).toLocaleDateString()} · {it.country_code}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail */}
                <div>
                    {!active ? (
                        <div className="zm-card p-12 text-center">
                            <Sparkle size={32} weight="fill" className="mx-auto mb-4 text-[#2563EB]" />
                            <h3 className="font-display text-xl font-bold mb-2">Pick a kit, or generate one.</h3>
                            <p className="text-sm text-[#64748B]">Each kit is country-aware: SEO keywords + competitors + tone all match your selected country.</p>
                        </div>
                    ) : (
                        <ContentDetail content={active} onPublish={publish} onDelete={remove} />
                    )}
                </div>
            </div>
        </div>
    );
}

function ContentDetail({ content, onPublish, onDelete }) {
    const k = content.kit || {};
    const copy = (text, label) => { navigator.clipboard.writeText(text); toast.success(`${label} copied`); };

    return (
        <div className="space-y-6" data-testid="content-detail">
            {/* Header */}
            <div className="zm-card p-6">
                <div className="flex items-start justify-between mb-3 gap-3 flex-wrap">
                    <div>
                        <p className="zm-section-label">// {content.country_code} · {new Date(content.generated_at).toLocaleString()}</p>
                        <h2 className="font-display text-2xl font-black tracking-tight mt-1">{k.topic}</h2>
                    </div>
                    <div className="flex gap-2">
                        {content.status !== "PUBLISHED" && (
                            <button onClick={() => onPublish(content.id)} className="zm-btn-primary text-xs" data-testid="content-publish">
                                <CheckCircle size={12} weight="bold" /> Mark published
                            </button>
                        )}
                        <button onClick={() => onDelete(content.id)} className="zm-btn-secondary text-xs" data-testid="content-delete">
                            <Trash size={12} weight="bold" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Blog post */}
            {k.blog_post && (
                <div className="zm-card p-6" data-testid="content-blog">
                    <div className="flex items-center gap-2 mb-4">
                        <Article size={16} weight="bold" className="text-[#2563EB]" />
                        <p className="zm-section-label">// Blog post · {k.blog_post.reading_time_min} min read</p>
                    </div>
                    <h3 className="font-display text-2xl font-black tracking-tight mb-2">{k.blog_post.title}</h3>
                    <p className="text-xs text-[#64748B] font-mono mb-3">/{k.blog_post.slug}</p>
                    <p className="text-sm text-[#475569] italic mb-4 leading-relaxed">{k.blog_post.excerpt}</p>

                    {/* AI A/B tester for blog title */}
                    <details className="mt-4">
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[#D97706]">
                            ⚡ Try A/B variants for this title
                        </summary>
                        <div className="mt-4">
                            <ABTester defaultKind="headline" defaultText={k.blog_post.title} />
                        </div>
                    </details>

                    <details className="bg-[#F8FAFC] rounded-md p-4 border border-[#E2E8F0] mt-3">
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[#0F172A]">View body markdown ({k.blog_post.body_md?.length || 0} chars)</summary>
                        <pre className="text-xs whitespace-pre-wrap mt-3 text-[#0F172A] font-mono leading-relaxed max-h-96 overflow-auto">{k.blog_post.body_md}</pre>
                        <button onClick={() => copy(k.blog_post.body_md, "Body markdown")} className="zm-btn-secondary text-xs mt-3"><Clipboard size={12} weight="bold" /> Copy markdown</button>
                    </details>
                </div>
            )}

            {/* Meta tags */}
            {k.meta_tags && (
                <div className="zm-card p-6" data-testid="content-meta">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Hash size={16} weight="bold" className="text-[#2563EB]" />
                            <p className="zm-section-label">// Meta tags · drop into &lt;head&gt;</p>
                        </div>
                        <button onClick={() => copy(buildMetaHtml(k.meta_tags), "Meta HTML")} className="zm-btn-secondary text-xs">
                            <Code size={12} weight="bold" /> Copy as HTML
                        </button>
                    </div>
                    <div className="space-y-2 text-sm">
                        <MetaRow label="Title" value={k.meta_tags.title} max={60} />
                        <MetaRow label="Description" value={k.meta_tags.description} max={158} />
                        <MetaRow label="OG Title" value={k.meta_tags.og_title} />
                        <MetaRow label="OG Description" value={k.meta_tags.og_description} />
                        <MetaRow label="Twitter Title" value={k.meta_tags.twitter_title} />
                        <MetaRow label="Canonical" value={k.meta_tags.canonical_path} mono />
                    </div>
                    {Array.isArray(k.meta_tags.keywords) && (
                        <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                            <p className="zm-section-label mb-2">Keywords</p>
                            <div className="flex flex-wrap gap-1.5">
                                {k.meta_tags.keywords.map((kw, i) => (
                                    <span key={i} className="zm-badge bg-[#DBEAFE] text-[#1D4ED8]">{kw}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Social posts */}
            {Array.isArray(k.social_posts) && k.social_posts.length > 0 && (
                <div className="grid md:grid-cols-3 gap-4" data-testid="content-social">
                    {k.social_posts.map((s, i) => (
                        <div key={i} className="zm-card p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <ShareNetwork size={14} weight="bold" className="text-[#2563EB]" />
                                <p className="zm-section-label uppercase">{s.platform}</p>
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed mb-3 max-h-48 overflow-auto">{s.body}</p>
                            <div className="flex flex-wrap gap-1 mb-3">
                                {(s.hashtags || []).map((h, j) => (
                                    <span key={j} className="text-xs text-[#2563EB] font-semibold">#{(h || "").replace(/^#/, "")}</span>
                                ))}
                            </div>
                            <button onClick={() => copy(`${s.body}\n\n${(s.hashtags || []).map(h => `#${(h || "").replace(/^#/, "")}`).join(" ")}`, `${s.platform} post`)}
                                className="zm-btn-secondary text-xs w-full">
                                <Clipboard size={12} weight="bold" /> Copy post
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* SEO keywords */}
            {Array.isArray(k.seo_keywords) && k.seo_keywords.length > 0 && (
                <div className="zm-card overflow-hidden" data-testid="content-seo">
                    <div className="px-6 pt-6 pb-3 flex items-center gap-2">
                        <MagnifyingGlass size={16} weight="bold" className="text-[#2563EB]" />
                        <p className="zm-section-label">// SEO keywords to target</p>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                                <th className="text-left px-6 py-2 zm-section-label">Keyword</th>
                                <th className="text-left px-3 py-2 zm-section-label">Intent</th>
                                <th className="text-left px-3 py-2 zm-section-label">Difficulty</th>
                                <th className="text-right px-6 py-2 zm-section-label">Mo. searches</th>
                            </tr>
                        </thead>
                        <tbody>
                            {k.seo_keywords.map((s, i) => (
                                <tr key={i} className="border-b border-[#E2E8F0] last:border-b-0">
                                    <td className="px-6 py-3 font-semibold">{s.keyword}</td>
                                    <td className="px-3 py-3"><span className="zm-badge bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0]">{s.intent}</span></td>
                                    <td className="px-3 py-3"><span className={`zm-badge ${s.difficulty === "low" ? "bg-[#10B981] text-white" : s.difficulty === "medium" ? "bg-[#F59E0B] text-white" : "bg-[#DC2626] text-white"}`}>{s.difficulty}</span></td>
                                    <td className="px-6 py-3 text-right font-mono">{(s.monthly_searches_estimate || 0).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* CTA recommendation + JSON-LD */}
            {k.cta_recommendation && (
                <div className="zm-card p-5 bg-[#0F172A] text-white">
                    <p className="zm-section-label text-white/60 mb-1">// Funnel into</p>
                    <p className="text-sm">{k.cta_recommendation}</p>
                </div>
            )}
            {k.schema_jsonld && (
                <details className="zm-card p-5">
                    <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
                        <Code size={14} weight="bold" /> JSON-LD Article schema
                    </summary>
                    <pre className="text-xs whitespace-pre-wrap mt-3 font-mono bg-[#F8FAFC] p-3 rounded max-h-60 overflow-auto">{k.schema_jsonld}</pre>
                    <button onClick={() => copy(k.schema_jsonld, "JSON-LD")} className="zm-btn-secondary text-xs mt-3"><Clipboard size={12} weight="bold" /> Copy schema</button>
                </details>
            )}
        </div>
    );
}

function MetaRow({ label, value, max, mono }) {
    if (!value) return null;
    const len = (value || "").length;
    const over = max && len > max;
    return (
        <div className="flex items-start gap-3">
            <span className="zm-section-label w-32 shrink-0 pt-0.5">{label}</span>
            <span className={`flex-1 text-[#0F172A] ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
            {max && <span className={`text-[10px] font-bold tabular-nums shrink-0 ${over ? "text-[#DC2626]" : "text-[#94A3B8]"}`}>{len}/{max}</span>}
        </div>
    );
}

function buildMetaHtml(m) {
    return `<title>${m.title || ""}</title>
<meta name="description" content="${m.description || ""}" />
${m.canonical_path ? `<link rel="canonical" href="${m.canonical_path}" />` : ""}
<meta property="og:title" content="${m.og_title || ""}" />
<meta property="og:description" content="${m.og_description || ""}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${m.twitter_title || ""}" />
<meta name="twitter:description" content="${m.twitter_description || ""}" />
${(m.keywords || []).length ? `<meta name="keywords" content="${(m.keywords || []).join(", ")}" />` : ""}`;
}
