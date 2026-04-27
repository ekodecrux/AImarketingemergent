import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { UserPlus, Crown, Trash, Envelope, Bell } from "@phosphor-icons/react";

export default function Team() {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [form, setForm] = useState({ email: "", first_name: "", last_name: "" });
    const [inviting, setInviting] = useState(false);
    const [tempPassword, setTempPassword] = useState(null);
    const [briefPref, setBriefPref] = useState({ daily_email: false, hour_utc: 8 });
    const [savingPref, setSavingPref] = useState(false);

    const load = () => {
        setLoading(true);
        Promise.all([
            api.get("/team/members").then((r) => setMembers(r.data.members)),
            api.get("/briefing/preferences").then((r) => setBriefPref(r.data)),
        ]).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    const invite = async (e) => {
        e.preventDefault();
        setInviting(true);
        try {
            const r = await api.post("/team/invite", form);
            if (r.data.email_delivered) {
                setTempPassword(null);
                toast.success(`Invite emailed to ${form.email}`);
            } else {
                setTempPassword(r.data.temp_password);
                toast.success(`Invite created — share temp password with ${form.email} (email delivery failed)`);
            }
            setForm({ email: "", first_name: "", last_name: "" });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Invite failed");
        } finally { setInviting(false); }
    };

    const remove = async (id) => {
        if (!window.confirm("Remove this teammate?")) return;
        try {
            await api.delete(`/team/members/${id}`);
            toast("Removed");
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed");
        }
    };

    const saveBriefPref = async (next) => {
        setSavingPref(true);
        const updated = { ...briefPref, ...next };
        setBriefPref(updated);
        try {
            await api.post("/briefing/preferences", updated);
            toast.success("Preferences saved");
        } catch { toast.error("Save failed"); }
        finally { setSavingPref(false); }
    };

    const isOwner = members.find((m) => m.id === user?.id)?.is_owner;

    return (
        <div>
            <PageHeader
                eyebrow="// Workspace"
                title="Team"
                subtitle="Invite teammates to share leads, campaigns and pipeline."
                action={isOwner && (
                    <button onClick={() => setShowInvite(!showInvite)} className="zm-btn-primary" data-testid="invite-button">
                        <UserPlus size={14} weight="bold" /> Invite teammate
                    </button>
                )}
            />
            <div className="px-8 py-6 grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {showInvite && (
                        <div className="zm-card p-6">
                            <h3 className="font-display text-lg font-bold tracking-tight mb-4">Invite to workspace</h3>
                            <form onSubmit={invite} className="space-y-3" data-testid="invite-form">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="zm-label">First name</label>
                                        <input className="zm-input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} data-testid="invite-firstname" />
                                    </div>
                                    <div>
                                        <label className="zm-label">Last name</label>
                                        <input className="zm-input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} data-testid="invite-lastname" />
                                    </div>
                                </div>
                                <div>
                                    <label className="zm-label">Email *</label>
                                    <input type="email" required className="zm-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="invite-email" />
                                </div>
                                <div className="flex gap-2">
                                    <button disabled={inviting} className="zm-btn-primary flex-1" data-testid="invite-submit">
                                        {inviting ? "Sending…" : "Send invite"}
                                    </button>
                                    <button type="button" onClick={() => setShowInvite(false)} className="zm-btn-secondary">Cancel</button>
                                </div>
                            </form>
                            {tempPassword && (
                                <div className="mt-4 p-3 bg-[#FAF7F2] border-l-2 border-[#10B981] text-xs">
                                    <p className="font-bold uppercase tracking-[0.15em] text-[#71717A] mb-1">// Temporary password</p>
                                    <p className="font-mono">{tempPassword}</p>
                                    <p className="text-[#71717A] mt-1">Email sent. Share this if delivery fails.</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="zm-card divide-y divide-[#EDE5D4]" data-testid="members-list">
                        {loading && <p className="p-12 text-sm text-[#A1A1AA] text-center">Loading…</p>}
                        {!loading && members.map((m) => (
                            <div key={m.id} className="px-6 py-4 flex items-center gap-4" data-testid={`member-${m.id}`}>
                                <div className="w-10 h-10 bg-[#FF562D] text-white flex items-center justify-center font-semibold rounded-sm">
                                    {(m.first_name?.[0] || m.email[0]).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold flex items-center gap-2">
                                        {m.first_name} {m.last_name}
                                        {m.is_owner && <Crown size={12} weight="fill" className="text-[#F59E0B]" />}
                                    </p>
                                    <p className="text-xs text-[#71717A] truncate">{m.email}</p>
                                </div>
                                <span className="zm-badge bg-[#FAF7F2] text-[#0E0F11]">{m.is_owner ? "OWNER" : m.role.toUpperCase()}</span>
                                {isOwner && !m.is_owner && (
                                    <button onClick={() => remove(m.id)} className="text-[#71717A] hover:text-[#E32636] p-2" data-testid={`remove-${m.id}`}>
                                        <Trash size={16} weight="bold" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right column: Notification preferences */}
                <div className="space-y-6">
                    <div className="zm-card p-6" data-testid="briefing-prefs">
                        <div className="flex items-center gap-2 mb-3">
                            <Bell size={16} weight="bold" className="text-[#FF562D]" />
                            <h3 className="font-display text-lg font-bold tracking-tight">Daily Briefing</h3>
                        </div>
                        <p className="text-xs text-[#71717A] mb-4 leading-relaxed">
                            Get an AI-generated growth briefing emailed to you every morning — wins, risks and the 3 most important actions for today.
                        </p>
                        <label className="flex items-center justify-between cursor-pointer mb-4">
                            <span className="text-sm font-semibold">Email me daily</span>
                            <input
                                type="checkbox"
                                checked={briefPref.daily_email}
                                onChange={(e) => saveBriefPref({ daily_email: e.target.checked })}
                                disabled={savingPref}
                                className="w-4 h-4 accent-[#FF562D]"
                                data-testid="brief-toggle"
                            />
                        </label>
                        <div>
                            <label className="zm-label">Send hour (UTC)</label>
                            <select
                                value={briefPref.hour_utc}
                                onChange={(e) => saveBriefPref({ hour_utc: Number(e.target.value) })}
                                disabled={savingPref || !briefPref.daily_email}
                                className="zm-input"
                                data-testid="brief-hour"
                            >
                                {[...Array(24).keys()].map((h) => (
                                    <option key={h} value={h}>{String(h).padStart(2, "0")}:00 UTC</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="zm-card p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Envelope size={16} weight="bold" className="text-[#FF562D]" />
                            <h3 className="font-display text-lg font-bold tracking-tight">Inbound email</h3>
                        </div>
                        <p className="text-xs text-[#71717A] leading-relaxed">
                            Email replies sent to <span className="font-mono text-[#0E0F11]">{process.env.REACT_APP_SUPPORT_EMAIL || "your Gmail address"}</span> are auto-polled every 3 minutes via IMAP and routed to the matching lead in your Inbox.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
