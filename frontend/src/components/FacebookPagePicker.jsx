import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, FacebookLogo, InstagramLogo } from "@phosphor-icons/react";

export default function FacebookPagePicker({ onChange }) {
    const [data, setData] = useState({ pages: [], selected_page_id: null, connected: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);

    const load = async () => {
        try {
            const r = await api.get("/integrations/facebook/pages");
            setData(r.data);
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const select = async (pageId) => {
        setSaving(pageId);
        try {
            await api.post("/integrations/facebook/select-page", { page_id: pageId });
            toast.success("Default Facebook Page updated");
            await load();
            onChange?.(pageId);
        } catch (e) {
            toast.error(e.response?.data?.detail || "Failed to update");
        } finally {
            setSaving(null);
        }
    };

    if (loading || !data.connected || data.pages.length <= 1) return null;

    return (
        <div className="mt-4 pt-4 border-t border-[#E2E8F0]" data-testid="fb-page-picker">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#71717A] font-bold mb-2">// Pick a default Page ({data.pages.length} found)</p>
            <div className="space-y-1.5">
                {data.pages.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => select(p.id)}
                        disabled={saving === p.id}
                        className={`w-full text-left px-3 py-2 rounded-sm border text-xs flex items-center justify-between ${p.selected ? "border-[#1877F2] bg-[#DBEAFE]" : "border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}
                        data-testid={`fb-page-${p.id}`}
                    >
                        <span className="flex items-center gap-2">
                            <FacebookLogo size={14} weight="fill" className="text-[#1877F2]" />
                            <span className="font-bold text-[#0F172A]">{p.name}</span>
                            {p.has_instagram && (
                                <span className="zm-badge bg-[#FCE7F3] text-[#9D174D] text-[9px]">
                                    <InstagramLogo size={9} weight="fill" /> IG
                                </span>
                            )}
                        </span>
                        {p.selected && <CheckCircle size={14} weight="fill" className="text-[#1877F2]" />}
                    </button>
                ))}
            </div>
        </div>
    );
}
