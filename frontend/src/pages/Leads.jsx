import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Plus, Trash, MagnifyingGlass, X, Sparkle, UploadSimple } from "@phosphor-icons/react";

const STATUSES = ["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "NOT_INTERESTED"];

export default function Leads() {
    const navigate = useNavigate();
    const [data, setData] = useState({ leads: [], pagination: { total: 0, page: 1, pages: 1 } });
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [showScrape, setShowScrape] = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [loading, setLoading] = useState(true);
    const [scoring, setScoring] = useState(false);

    const load = () => {
        setLoading(true);
        const params = { page, limit: 20 };
        if (statusFilter) params.status_filter = statusFilter;
        api.get("/leads", { params })
            .then((r) => setData(r.data))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, statusFilter]);

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        await api.delete(`/leads/${id}`);
        toast.success("Lead deleted");
        load();
    };

    const handleStatusChange = async (id, status, e) => {
        e.stopPropagation();
        await api.put(`/leads/${id}`, { status });
        load();
    };

    const scoreAll = async () => {
        setScoring(true);
        const t = toast.loading("AI is analysing leads…");
        try {
            const r = await api.post("/leads/score-batch", {});
            toast.success(`Scored ${r.data.scored} leads`, { id: t });
            load();
        } catch (e) {
            toast.error("Score failed", { id: t });
        } finally { setScoring(false); }
    };

    return (
        <div>
            <PageHeader
                eyebrow="// Pipeline"
                title="Leads"
                subtitle={`${data.pagination.total} total · page ${data.pagination.page} of ${data.pagination.pages || 1}`}
                action={
                    <div className="flex gap-3">
                        <button data-testid="score-all-leads" onClick={scoreAll} disabled={scoring} className="zm-btn-dark">
                            <Sparkle size={14} weight="fill" /> {scoring ? "Scoring…" : "AI Score All"}
                        </button>
                        <button data-testid="open-scrape-modal" onClick={() => setShowScrape(true)} className="zm-btn-secondary">
                            <MagnifyingGlass size={14} weight="bold" /> Scrape
                        </button>
                        <button data-testid="open-bulk-upload-modal" onClick={() => setShowBulk(true)} className="zm-btn-secondary">
                            <UploadSimple size={14} weight="bold" /> Bulk Upload
                        </button>
                        <button data-testid="open-add-lead-modal" onClick={() => setShowAdd(true)} className="zm-btn-primary">
                            <Plus size={14} weight="bold" /> Add Lead
                        </button>
                    </div>
                }
            />

            <div className="px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="zm-section-label">Filter</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="zm-input w-auto"
                        data-testid="leads-status-filter"
                    >
                        <option value="">All statuses</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="zm-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#E2E8F0]">
                                <th className="text-left px-4 py-3 zm-section-label">Contact / Company</th>
                                <th className="text-left px-4 py-3 zm-section-label">Email</th>
                                <th className="text-left px-4 py-3 zm-section-label">Phone</th>
                                <th className="text-left px-4 py-3 zm-section-label">Address</th>
                                <th className="text-left px-4 py-3 zm-section-label">Source</th>
                                <th className="text-left px-4 py-3 zm-section-label">Status</th>
                                <th className="text-left px-4 py-3 zm-section-label">Score</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody data-testid="leads-table-body">
                            {loading && (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-[#A1A1AA]">Loading…</td></tr>
                            )}
                            {!loading && data.leads.length === 0 && (
                                <tr><td colSpan={8} className="px-4 py-16 text-center text-[#A1A1AA]">
                                    No leads. Add manually or use Scrape.
                                </td></tr>
                            )}
                            {data.leads.map((l) => (
                                <tr key={l.id} onClick={() => navigate(`/leads/${l.id}`)} className="border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F9F9FB] cursor-pointer" data-testid={`lead-row-${l.id}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="min-w-0">
                                                <p className="font-semibold truncate">{l.name || "—"}</p>
                                                <p className="text-[11px] text-[#64748B] truncate">{l.company || "—"}{l.role ? ` · ${l.role}` : ""}</p>
                                            </div>
                                            {l.is_sample && (
                                                <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider bg-[#FEF3C7] text-[#92400E] px-1.5 py-0.5 rounded" title="AI-generated demo data — not a real lead">AI SAMPLE</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-[#71717A]">{l.email || "—"}</td>
                                    <td className="px-4 py-3 text-[#71717A]">{l.phone || "—"}</td>
                                    <td className="px-4 py-3 text-[#71717A] text-xs max-w-[180px] truncate" title={l.address || ""}>{l.address || "—"}</td>
                                    <td className="px-4 py-3"><span className="zm-badge bg-[#F8FAFC] text-[#0F172A]">{l.source}</span></td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                        <select value={l.status} onChange={(e) => handleStatusChange(l.id, e.target.value, e)} className="text-xs border border-[#E2E8F0] px-2 py-1 bg-white">
                                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <ScoreCell score={l.score || 0} />
                                    </td>
                                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                        <button data-testid={`delete-lead-${l.id}`} onClick={(e) => handleDelete(l.id, e)} className="text-[#71717A] hover:text-[#E32636]">
                                            <Trash size={16} weight="bold" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-[#71717A]">
                        {data.pagination.total} results
                    </p>
                    <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(page - 1)} className="zm-btn-secondary disabled:opacity-40" data-testid="leads-prev-page">Prev</button>
                        <button disabled={page >= (data.pagination.pages || 1)} onClick={() => setPage(page + 1)} className="zm-btn-secondary disabled:opacity-40" data-testid="leads-next-page">Next</button>
                    </div>
                </div>
            </div>

            {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
            {showScrape && <ScrapeModal onClose={() => setShowScrape(false)} onDone={() => { setShowScrape(false); load(); }} />}
            {showBulk && <BulkUploadModal onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); load(); }} />}
        </div>
    );
}

function BulkUploadModal({ onClose, onDone }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Close on Escape
    useEffect(() => {
        const h = (e) => { if (e.key === "Escape") (result ? onDone() : onClose()); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [result, onClose, onDone]);

    // Auto-close 1.5s after successful import
    useEffect(() => {
        if (result && result.imported > 0) {
            const t = setTimeout(() => onDone(), 1500);
            return () => clearTimeout(t);
        }
    }, [result, onDone]);

    const submit = async (e) => {
        e.preventDefault();
        if (!file) { toast.error("Choose a CSV file first"); return; }
        const fd = new FormData();
        fd.append("file", file);
        setLoading(true);
        try {
            const r = await api.post("/leads/import-csv", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setResult(r.data);
            toast.success(`Imported ${r.data.imported} leads`);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Upload failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell title="Bulk upload leads" eyebrow="// CSV import" onClose={onClose}>
            <form onSubmit={submit} className="space-y-4" data-testid="bulk-upload-form">
                <div className="bg-[#F8FAFC] border-l-2 border-[#2563EB] p-3 text-xs text-[#475569] leading-relaxed">
                    <p className="font-bold text-[#0F172A] mb-1">CSV format (any column order):</p>
                    <code className="text-[11px]">email, first_name, last_name, phone, company, role, address, website, notes, source</code>
                    <p className="mt-2">Only <span className="font-bold">email OR phone</span> is required. <strong>Company</strong> highly recommended for B2B targeting. Max 5,000 rows / 5MB per file. Duplicates auto-skipped.</p>
                </div>
                <div>
                    <label className="zm-label">CSV file</label>
                    <input type="file" accept=".csv,text/csv" required onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
                        className="block w-full text-sm border border-[#E2E8F0] rounded-md p-2" data-testid="bulk-upload-file" />
                </div>
                {result && (
                    <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-md p-3 text-xs space-y-1" data-testid="bulk-upload-result">
                        <p className="font-bold text-[#15803D]">✓ Imported: {result.imported}</p>
                        <p className="text-[#475569]">Duplicates skipped: {result.skipped_duplicates_in_workspace || 0}</p>
                        <p className="text-[#475569]">Rejected: {result.rejected || 0}</p>
                        {(result.rejection_sample || []).length > 0 && (
                            <details className="mt-2">
                                <summary className="cursor-pointer text-[#64748B]">Rejection reasons ({result.rejection_sample.length})</summary>
                                <ul className="mt-1 pl-4 list-disc text-[11px] text-[#64748B]">
                                    {result.rejection_sample.map((r, i) => <li key={i}>Row {r.row}: {r.reason}</li>)}
                                </ul>
                            </details>
                        )}
                    </div>
                )}
                <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={loading || !file} className="zm-btn-primary flex-1" data-testid="bulk-upload-submit">
                        {loading ? "Uploading…" : (result ? "Upload another" : "Upload CSV")}
                    </button>
                    <button type="button" onClick={result ? onDone : onClose} className="zm-btn-secondary">
                        {result ? "Done" : "Cancel"}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
}

function ScoreCell({ score }) {
    const color = score >= 75 ? "#10B981" : score >= 50 ? "#F59E0B" : score >= 25 ? "#71717A" : "#E32636";
    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold" style={{ color }}>{score}</span>
            <div className="w-16 h-1 bg-[#F8FAFC]">
                <div className="h-full" style={{ width: `${score}%`, background: color }} />
            </div>
        </div>
    );
}

function AddLeadModal({ onClose, onSaved }) {
    const [form, setForm] = useState({
        name: "", email: "", phone: "", company: "", role: "",
        address: "", website: "", notes: "",
    });
    const [loading, setLoading] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        if (!form.company.trim() && !form.email.trim() && !form.phone.trim()) {
            toast.error("Add at least company, email, or phone — a name alone isn't actionable");
            return;
        }
        setLoading(true);
        try {
            await api.post("/leads", form);
            toast.success("Lead added");
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to add");
        } finally {
            setLoading(false);
        }
    };
    const FIELDS = [
        { k: "name", label: "Contact name *", required: true, placeholder: "Owner, CEO, or full name" },
        { k: "company", label: "Company / school / business name *", required: true, placeholder: "Acme Pvt Ltd · Greenwood Academy" },
        { k: "role", label: "Role / designation", placeholder: "Principal, Owner, Marketing Head" },
        { k: "email", label: "Email", placeholder: "owner@example.com" },
        { k: "phone", label: "Phone (E.164)", placeholder: "+919876543210" },
        { k: "website", label: "Website", placeholder: "https://example.com" },
        { k: "address", label: "Address (city + state + zip)", placeholder: "Indiranagar, Bengaluru, KA 560038" },
    ];
    return (
        <ModalShell title="Add lead" eyebrow="// New record" onClose={onClose}>
            <form onSubmit={submit} className="space-y-4" data-testid="add-lead-form">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FIELDS.map(({ k, label, required, placeholder }) => (
                        <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
                            <label className="zm-label">{label}</label>
                            <input className="zm-input" required={required} value={form[k]}
                                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                                placeholder={placeholder}
                                data-testid={`add-lead-${k}`} />
                        </div>
                    ))}
                </div>
                <div>
                    <label className="zm-label">Notes</label>
                    <textarea className="zm-input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="add-lead-notes" placeholder="How you met, deal context, custom tags…" />
                </div>
                <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={loading} className="zm-btn-primary flex-1" data-testid="add-lead-submit">{loading ? "Saving…" : "Add lead"}</button>
                    <button type="button" onClick={onClose} className="zm-btn-secondary">Cancel</button>
                </div>
            </form>
        </ModalShell>
    );
}

function ScrapeModal({ onClose, onDone }) {
    const [type, setType] = useState("GOOGLE_MAPS_LEADS");
    const [location, setLocation] = useState("");
    const [keyword, setKeyword] = useState("");
    const [website, setWebsite] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post("/scraping/start", { type, location, keyword, website });
            toast.success(`Imported ${res.data.count} leads`);
            onDone();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Scrape failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell title="AI Lead Discovery" eyebrow="// Demo · sample leads" onClose={onClose}>
            <form onSubmit={submit} className="space-y-4" data-testid="scrape-form">
                <div className="bg-[#FFFBEB] border-l-2 border-[#F59E0B] p-3 text-xs text-[#92400E] leading-relaxed">
                    <p className="font-bold text-[#0F172A] mb-1">⚠ These are AI-generated <em>sample</em> leads, not real scraped data</p>
                    <p>Useful for demos, persona testing, and content drafts. They'll be tagged <span className="font-mono bg-white px-1 rounded">AI SAMPLE</span> in your CRM.</p>
                    <p className="mt-1.5">For <strong>real verified leads</strong>: use <span className="font-mono">Bulk Upload</span> (your CSV) or bind a paid lead-gen API (Apollo / ZoomInfo / Hunter — coming soon to /admin/integrations).</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        ["GOOGLE_MAPS_LEADS", "Maps-style"],
                        ["LINKEDIN_LEADS", "LinkedIn-style"],
                        ["COMPETITOR_KEYWORDS", "Competitors"],
                    ].map(([v, label]) => (
                        <button
                            key={v} type="button" onClick={() => setType(v)}
                            data-testid={`scrape-type-${v}`}
                            className={`px-3 py-2.5 text-xs uppercase tracking-[0.15em] font-bold border ${
                                type === v ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-[#71717A] border-[#E2E8F0] hover:border-[#0F172A]"
                            }`}
                        >{label}</button>
                    ))}
                </div>

                {type !== "COMPETITOR_KEYWORDS" ? (
                    <>
                        <div>
                            <label className="zm-label">Location {type === "LINKEDIN_LEADS" && "(optional)"}</label>
                            <input className="zm-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Bangalore, India" data-testid="scrape-location" />
                        </div>
                        <div>
                            <label className="zm-label">Keyword / Role</label>
                            <input className="zm-input" required value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g., dental clinics" data-testid="scrape-keyword" />
                        </div>
                    </>
                ) : (
                    <div>
                        <label className="zm-label">Competitor website</label>
                        <input className="zm-input" required value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" data-testid="scrape-website" />
                    </div>
                )}

                <p className="text-xs text-[#71717A] bg-[#F8FAFC] p-3 border-l-2 border-[#2563EB]">
                    Powered by Groq AI · Generates research-grade lead data based on your inputs and auto-imports into your pipeline.
                </p>

                <div className="flex gap-3">
                    <button type="submit" disabled={loading} className="zm-btn-primary flex-1" data-testid="scrape-submit">{loading ? "Scraping…" : "Start scrape"}</button>
                    <button type="button" onClick={onClose} className="zm-btn-secondary">Cancel</button>
                </div>
            </form>
        </ModalShell>
    );
}

export function ModalShell({ title, eyebrow, onClose, children, size = "md" }) {
    const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
            <div className={`bg-white border border-[#E2E8F0] w-full ${widths[size]} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between p-6 border-b border-[#E2E8F0]">
                    <div>
                        {eyebrow && <p className="zm-section-label mb-1">{eyebrow}</p>}
                        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
                    </div>
                    <button onClick={onClose} className="text-[#71717A] hover:text-[#0F172A]" data-testid="modal-close">
                        <X size={18} weight="bold" />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}
