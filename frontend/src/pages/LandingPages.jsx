import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    Plus, Trash, ArrowSquareOut, Eye, PencilSimple, Globe,
    CheckCircle, ChartLineUp,
} from "@phosphor-icons/react";

export default function LandingPages() {
    const navigate = useNavigate();
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [title, setTitle] = useState("");

    const load = () => {
        setLoading(true);
        api.get("/landing-pages")
            .then((r) => setPages(r.data.pages))
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const create = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const r = await api.post("/landing-pages", { title });
            toast.success("Page created");
            navigate(`/landing-pages/${r.data.page.id}`);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Create failed");
        } finally { setCreating(false); }
    };

    const remove = async (id) => {
        if (!window.confirm("Delete this page permanently?")) return;
        await api.delete(`/landing-pages/${id}`);
        toast("Deleted");
        load();
    };

    const publicUrl = (slug) => `${window.location.origin}/p/${slug}`;

    return (
        <div>
            <PageHeader
                eyebrow="// Inbound capture"
                title="Landing Pages"
                subtitle="Build public pages with AI-generated copy. Form submissions land directly in your CRM."
                action={
                    <button onClick={() => setShowCreate(true)} className="zm-btn-primary" data-testid="new-landing-page">
                        <Plus size={14} weight="bold" /> New page
                    </button>
                }
            />
            <div className="px-8 py-6">
                {showCreate && (
                    <form onSubmit={create} className="zm-card p-6 mb-6 flex gap-3 items-end" data-testid="create-form">
                        <div className="flex-1">
                            <label className="zm-label">Page title</label>
                            <input required className="zm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spring promo, Free demo" autoFocus data-testid="create-title" />
                        </div>
                        <button disabled={creating} className="zm-btn-primary" data-testid="create-submit">
                            {creating ? "Creating…" : "Create & edit"}
                        </button>
                        <button type="button" onClick={() => setShowCreate(false)} className="zm-btn-secondary">Cancel</button>
                    </form>
                )}

                {loading ? (
                    <p className="zm-card p-12 text-center text-sm text-[#A1A1AA]">Loading…</p>
                ) : pages.length === 0 ? (
                    <div className="zm-card p-16 text-center">
                        <Globe size={32} weight="bold" className="mx-auto mb-4 text-[#A1A1AA]" />
                        <p className="zm-section-label mb-2">// Nothing here yet</p>
                        <h3 className="font-display text-2xl font-bold tracking-tight mb-4">Build your first landing page.</h3>
                        <button onClick={() => setShowCreate(true)} className="zm-btn-primary" data-testid="empty-create">
                            <Plus size={14} weight="bold" /> New page
                        </button>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="pages-grid">
                        {pages.map((p) => (
                            <div key={p.id} className="zm-card p-5 flex flex-col" data-testid={`page-${p.id}`}>
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="font-display text-lg font-bold tracking-tight line-clamp-2">{p.title}</h3>
                                    {p.published ? (
                                        <span className="zm-badge bg-[#10B981] text-white inline-flex items-center gap-1">
                                            <CheckCircle size={10} weight="fill" /> LIVE
                                        </span>
                                    ) : (
                                        <span className="zm-badge bg-[#F8FAFC] text-[#71717A]">DRAFT</span>
                                    )}
                                </div>
                                <p className="text-xs text-[#71717A] font-mono mb-3 truncate">/p/{p.slug}</p>
                                <div className="flex items-center gap-3 text-xs text-[#71717A] mb-4 mt-auto">
                                    <span className="flex items-center gap-1"><Eye size={12} weight="bold" /> {p.view_count || 0}</span>
                                    <span className="flex items-center gap-1"><ChartLineUp size={12} weight="bold" /> {p.submission_count || 0} leads</span>
                                </div>
                                <div className="flex gap-2">
                                    <Link to={`/landing-pages/${p.id}`} className="zm-btn-primary flex-1 text-xs py-2" data-testid={`edit-${p.id}`}>
                                        <PencilSimple size={12} weight="bold" /> Edit
                                    </Link>
                                    {p.published && (
                                        <a href={publicUrl(p.slug)} target="_blank" rel="noreferrer" className="zm-btn-secondary text-xs py-2" data-testid={`view-${p.id}`}>
                                            <ArrowSquareOut size={12} weight="bold" />
                                        </a>
                                    )}
                                    <button onClick={() => remove(p.id)} className="zm-btn-secondary text-xs py-2 hover:text-[#E32636]" data-testid={`delete-${p.id}`}>
                                        <Trash size={12} weight="bold" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
