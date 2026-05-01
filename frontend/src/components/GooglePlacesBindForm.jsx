import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Lock, ArrowSquareOut, MapPin, CheckCircle, FloppyDisk, Trash } from "@phosphor-icons/react";

export default function GooglePlacesBindForm() {
    const [state, setState] = useState({ enabled: false, has_key: false, key_preview: "" });
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            const r = await api.get("/lead-sources/google-places");
            setState(r.data);
        } catch (_) { /* ignore */ }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const save = async (e) => {
        e?.preventDefault?.();
        setBusy(true);
        try {
            // First save key (if provided), then verify by calling test, then enable
            const r = await api.post("/lead-sources/google-places", {
                enabled: false,
                api_key: apiKey || undefined,
            });
            if (apiKey) {
                // Verify the key works before flipping enabled=true
                try {
                    const t = await api.post("/lead-sources/google-places/test");
                    if (t.data?.verified) {
                        await api.post("/lead-sources/google-places", { enabled: true });
                        toast.success(`Google Places verified — ${t.data.result_count} test results returned. ON.`);
                    }
                } catch (te) {
                    toast.error(te.response?.data?.detail || "Key saved but test failed — kept OFF.");
                }
            }
            setApiKey(""); setShowForm(false); load();
            void r;
        } catch (e) {
            toast.error(e.response?.data?.detail || "Save failed");
        } finally { setBusy(false); }
    };

    const toggle = async (next) => {
        setBusy(true);
        try {
            if (next && !state.has_key) {
                setShowForm(true);
                toast.error("Add an API key first to enable Google Places.");
                return;
            }
            await api.post("/lead-sources/google-places", { enabled: next });
            toast.success(`Google Places ${next ? "ON" : "OFF"}`);
            load();
        } catch (e) {
            toast.error(e.response?.data?.detail || "Toggle failed");
        } finally { setBusy(false); }
    };

    const remove = async () => {
        if (!window.confirm("Remove Google Places API key? Lead Discovery will fall back to AI sample data.")) return;
        setBusy(true);
        try {
            await api.delete("/lead-sources/google-places");
            toast.success("Google Places removed");
            load();
        } catch (e) {
            toast.error("Remove failed");
        } finally { setBusy(false); }
    };

    if (loading) return <div className="zm-card p-5 text-xs text-[#A1A1AA]">Loading…</div>;

    return (
        <div className="zm-card p-5" data-testid="google-places-card">
            <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 flex items-center justify-center rounded-sm bg-[#4285F4]">
                    <MapPin size={18} weight="fill" className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-display text-sm font-bold tracking-tight">Google Places API</h4>
                        {state.enabled && state.has_key && (
                            <span className="zm-badge text-[9px] bg-[#D1FAE5] text-[#065F46]">
                                <CheckCircle size={9} weight="bold" /> ON · LIVE
                            </span>
                        )}
                        {!state.enabled && (
                            <span className="zm-badge text-[9px] bg-[#F3F4F6] text-[#6B7280]">OFF · Default</span>
                        )}
                    </div>
                    <p className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed">
                        Real Google Maps businesses with verified phone, website, address. <strong>$200/mo free credit</strong> from Google = ~12,000 searches.
                    </p>
                </div>
            </div>

            {/* Toggle row */}
            <div className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-md mb-3" data-testid="gplaces-toggle-row">
                <div>
                    <p className="text-[11px] font-bold text-[#0F172A]">Use real Google data when scraping</p>
                    <p className="text-[10px] text-[#64748B]">{state.enabled ? "Lead Discovery will hit your Google account." : "Falls back to AI-generated samples (free)."}</p>
                </div>
                <button onClick={() => toggle(!state.enabled)} disabled={busy}
                    className={`relative w-11 h-6 rounded-full transition-colors ${state.enabled ? "bg-[#10B981]" : "bg-[#CBD5E1]"}`}
                    data-testid="gplaces-toggle">
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${state.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
            </div>

            {/* Saved key state */}
            {state.has_key && !showForm && (
                <div className="flex items-center justify-between border border-[#E2E8F0] bg-white p-2 rounded-md mb-3 text-[11px]" data-testid="gplaces-saved">
                    <span className="font-mono text-[#0F172A]"><Lock size={10} weight="bold" className="inline mr-1 text-[#10B981]" />{state.key_preview}</span>
                    <div className="flex gap-2">
                        <button onClick={() => setShowForm(true)} className="text-[#2563EB] font-bold uppercase tracking-wider text-[10px] hover:underline" data-testid="gplaces-replace">Replace</button>
                        <button onClick={remove} disabled={busy} className="text-[#DC2626] font-bold uppercase tracking-wider text-[10px] hover:underline" data-testid="gplaces-remove"><Trash size={10} weight="bold" className="inline" /> Remove</button>
                    </div>
                </div>
            )}

            {/* Add / replace form */}
            {(!state.has_key || showForm) && (
                <form onSubmit={save} className="space-y-2 mb-3" autoComplete="off">
                    <input type="text" name="prevent-autofill-u" autoComplete="username" style={{ display: "none" }} aria-hidden="true" />
                    <input type="password" name="prevent-autofill-p" autoComplete="current-password" style={{ display: "none" }} aria-hidden="true" />
                    <label className="block text-[10px] uppercase tracking-[0.15em] text-[#0F172A] font-bold">Google Places API Key</label>
                    <div className="relative">
                        <input
                            type={showKey ? "text" : "password"}
                            name="zm-google-places-key"
                            autoComplete="new-password"
                            data-form-type="other"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            spellCheck={false}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full text-xs font-mono px-3 py-2 pr-14 border border-[#CBD5E1] rounded-md bg-white focus:outline-none focus:border-[#2563EB]"
                            data-testid="gplaces-key-input"
                            required
                        />
                        <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase text-[#2563EB] font-bold">
                            {showKey ? "Hide" : "Show"}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" disabled={busy || !apiKey} className="zm-btn-primary text-xs flex-1" data-testid="gplaces-save">
                            <FloppyDisk size={12} weight="bold" /> {busy ? "Verifying…" : "Save & verify"}
                        </button>
                        {showForm && (
                            <button type="button" onClick={() => { setShowForm(false); setApiKey(""); }} className="zm-btn-secondary text-xs">Cancel</button>
                        )}
                    </div>
                </form>
            )}

            {/* Help link */}
            <a href="https://console.cloud.google.com/apis/library/places.googleapis.com" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] font-bold text-[#2563EB] hover:underline">
                Get API key from Google Cloud Console <ArrowSquareOut size={10} weight="bold" />
            </a>
        </div>
    );
}
