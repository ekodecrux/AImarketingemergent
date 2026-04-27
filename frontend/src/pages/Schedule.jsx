import { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import {
    CalendarBlank, Plus, X, LinkedinLogo, TwitterLogo, InstagramLogo,
    EnvelopeSimple, Article, Lightning, CheckCircle, Clock, WarningCircle,
} from "@phosphor-icons/react";

const PLATFORMS = [
    { id: "linkedin", label: "LinkedIn", icon: LinkedinLogo, color: "#0077B5" },
    { id: "twitter", label: "Twitter / X", icon: TwitterLogo, color: "#1DA1F2" },
    { id: "instagram", label: "Instagram", icon: InstagramLogo, color: "#E1306C" },
    { id: "blog", label: "Blog post", icon: Article, color: "#10B981" },
    { id: "email_broadcast", label: "Email blast", icon: EnvelopeSimple, color: "#F59E0B" },
];

function startOfWeek(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

function addDays(d, n) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
}

function isoDay(d) {
    return d.toISOString().slice(0, 10);
}

export default function Schedule() {
    const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
    const [schedules, setSchedules] = useState([]);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [picker, setPicker] = useState(null); // { date, time, content_id, platforms }
    const [autoOpts, setAutoOpts] = useState(null);

    const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

    const load = () => {
        setLoading(true);
        const from = weekStart.toISOString();
        const to = addDays(weekStart, 7).toISOString();
        Promise.all([
            api.get(`/schedule?from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}`).then((r) => setSchedules(r.data.schedules || [])),
            api.get("/content").then((r) => setContents(r.data.content || [])),
            api.get("/alerts/preferences").then((r) => setAutoOpts(r.data.preferences)).catch(() => {}),
        ]).finally(() => setLoading(false));
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [weekStart]);

    const open = (date, hour = 10) => {
        const dt = new Date(date);
        dt.setHours(hour, 0, 0, 0);
        setPicker({
            date: isoDay(dt),
            time: `${String(hour).padStart(2, "0")}:00`,
            content_id: contents[0]?.id || "",
            platforms: ["linkedin", "blog"],
        });
    };

    const submit = async () => {
        if (!picker.content_id) { toast.error("Pick a content kit"); return; }
        if (picker.platforms.length === 0) { toast.error("Pick at least one platform"); return; }
        const when = new Date(`${picker.date}T${picker.time}:00`);
        try {
            await api.post("/schedule", {
                content_id: picker.content_id,
                scheduled_at: when.toISOString(),
                platforms: picker.platforms,
            });
            toast.success("Scheduled");
            setPicker(null);
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed");
        }
    };

    const remove = async (id) => {
        await api.delete(`/schedule/${id}`);
        toast.success("Removed");
        load();
    };

    const publishNow = async (id) => {
        const t = toast.loading("Publishing…");
        try {
            const r = await api.post(`/schedule/${id}/publish-now`);
            toast.success(`Published · ${r.data.status}`, { id: t });
            load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed", { id: t });
        }
    };

    const toggleAuto = async (key, value) => {
        const updated = { ...autoOpts, [key]: value };
        setAutoOpts(updated);
        try {
            await api.post("/alerts/preferences", updated);
            toast.success("Saved");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Save failed");
            api.get("/alerts/preferences").then((r) => setAutoOpts(r.data.preferences));
        }
    };

    return (
        <div data-testid="schedule-page">
            <PageHeader
                eyebrow="// Auto-publish queue"
                title="Content Schedule"
                subtitle="Drop content kits onto a 7-day calendar — they auto-publish at the scheduled time."
                action={
                    <div className="flex gap-2">
                        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="zm-btn-secondary text-xs">‹ Prev</button>
                        <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="zm-btn-secondary text-xs">Today</button>
                        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="zm-btn-secondary text-xs">Next ›</button>
                    </div>
                }
            />
            <div className="px-8 py-6 space-y-6">
                {/* Auto-mode banner */}
                {autoOpts && (
                    <div className="zm-card p-5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white" data-testid="auto-options">
                        <div className="flex items-start gap-4 flex-wrap">
                            <Lightning size={20} weight="fill" className="shrink-0 mt-1" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/80 mb-1">// Autopilot</p>
                                <h3 className="font-display text-lg font-bold tracking-tight">Run the calendar on autopilot</h3>
                                <p className="text-xs text-white/80 mt-1">Generate a fresh content kit daily, and auto-schedule extras when forecast is at risk.</p>
                            </div>
                            <div className="space-y-2 min-w-[260px]">
                                <ToggleRow label="Daily content auto-generation" checked={autoOpts.auto_daily_content} onChange={(v) => toggleAuto("auto_daily_content", v)} testid="toggle-auto-content" />
                                <ToggleRow label="Auto-recover when forecast at risk" checked={autoOpts.auto_publish_when_at_risk} onChange={(v) => toggleAuto("auto_publish_when_at_risk", v)} testid="toggle-auto-recovery" />
                            </div>
                        </div>
                    </div>
                )}

                {/* 7-day calendar */}
                <div className="zm-card overflow-hidden" data-testid="calendar-grid">
                    <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {days.map((d) => (
                            <div key={isoDay(d)} className="px-3 py-3 text-center border-r border-[#E2E8F0] last:border-r-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#64748B]">{d.toLocaleDateString(undefined, { weekday: "short" })}</p>
                                <p className={`font-display text-2xl font-black tracking-tight mt-0.5 ${d.toDateString() === new Date().toDateString() ? "text-[#2563EB]" : ""}`}>
                                    {d.getDate()}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 min-h-[400px]">
                        {days.map((d) => {
                            const dayKey = isoDay(d);
                            const items = schedules.filter((s) => s.scheduled_at && s.scheduled_at.startsWith(dayKey));
                            return (
                                <div key={dayKey} className="border-r border-[#E2E8F0] last:border-r-0 p-2 space-y-2 bg-white relative" data-testid={`day-${dayKey}`}>
                                    {items.map((it) => (
                                        <ScheduleCard key={it.id} item={it} onRemove={remove} onPublishNow={publishNow} />
                                    ))}
                                    <button
                                        onClick={() => open(d)}
                                        className="w-full mt-1 py-2 border border-dashed border-[#E2E8F0] rounded-md text-xs text-[#94A3B8] hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#DBEAFE]/30 transition-colors flex items-center justify-center gap-1"
                                        data-testid={`add-${dayKey}`}
                                    >
                                        <Plus size={12} weight="bold" /> Schedule
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {!loading && schedules.length === 0 && (
                    <div className="text-center py-8 text-sm text-[#64748B]">
                        No posts scheduled this week. Click <strong>Schedule</strong> on any day to start.
                    </div>
                )}
            </div>

            {picker && (
                <ScheduleModal
                    picker={picker}
                    setPicker={setPicker}
                    contents={contents}
                    onSubmit={submit}
                />
            )}
        </div>
    );
}

function ScheduleCard({ item, onRemove, onPublishNow }) {
    const time = new Date(item.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isPub = item.status === "PUBLISHED";
    const isFailed = item.status === "FAILED";
    const StatusIcon = isPub ? CheckCircle : isFailed ? WarningCircle : Clock;
    const statusColor = isPub ? "#10B981" : isFailed ? "#DC2626" : "#94A3B8";
    return (
        <div className={`text-xs rounded-md border p-2 ${isPub ? "bg-[#D1FAE5] border-[#10B981]" : isFailed ? "bg-[#FEE2E2] border-[#DC2626]" : "bg-[#DBEAFE] border-[#2563EB]/30"} group`} data-testid={`schedule-${item.id}`}>
            <div className="flex items-start justify-between gap-1 mb-1">
                <span className="font-mono text-[10px] font-bold flex items-center gap-1" style={{ color: statusColor }}>
                    <StatusIcon size={10} weight="bold" /> {time}
                </span>
                <button onClick={() => onRemove(item.id)} className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#DC2626]" title="Remove">
                    <X size={10} weight="bold" />
                </button>
            </div>
            <p className="font-bold text-[11px] line-clamp-2 leading-snug text-[#0F172A]">{item.title}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
                {(item.platforms || []).map((p) => {
                    const cfg = PLATFORMS.find((x) => x.id === p);
                    if (!cfg) return null;
                    return <cfg.icon key={p} size={11} weight="fill" style={{ color: cfg.color }} title={cfg.label} />;
                })}
            </div>
            {!isPub && !isFailed && (
                <button onClick={() => onPublishNow(item.id)} className="text-[10px] text-[#2563EB] font-bold hover:underline mt-1" data-testid={`publish-now-${item.id}`}>
                    Publish now →
                </button>
            )}
        </div>
    );
}

function ScheduleModal({ picker, setPicker, contents, onSubmit }) {
    return (
        <div className="fixed inset-0 bg-[#0F172A]/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPicker(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" data-testid="schedule-modal">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="zm-section-label">// Schedule a post</p>
                        <h3 className="font-display text-2xl font-black tracking-tight mt-1">{new Date(picker.date + "T" + picker.time).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
                    </div>
                    <button onClick={() => setPicker(null)} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={18} weight="bold" /></button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="zm-label">Date</label>
                            <input type="date" className="zm-input" value={picker.date} onChange={(e) => setPicker({ ...picker, date: e.target.value })} data-testid="schedule-date" />
                        </div>
                        <div>
                            <label className="zm-label">Time</label>
                            <input type="time" className="zm-input" value={picker.time} onChange={(e) => setPicker({ ...picker, time: e.target.value })} data-testid="schedule-time" />
                        </div>
                    </div>
                    <div>
                        <label className="zm-label">Content kit</label>
                        {contents.length === 0 ? (
                            <p className="text-xs text-[#94A3B8] py-3 px-3 bg-[#F8FAFC] rounded-md border border-[#E2E8F0]">
                                No kits yet — go to Content Studio and generate one first.
                            </p>
                        ) : (
                            <select className="zm-input" value={picker.content_id} onChange={(e) => setPicker({ ...picker, content_id: e.target.value })} data-testid="schedule-content">
                                {contents.map((c) => (
                                    <option key={c.id} value={c.id}>{(c.kit?.blog_post?.title || c.topic || "Untitled").slice(0, 80)}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="zm-label">Platforms</label>
                        <div className="grid grid-cols-2 gap-2" data-testid="schedule-platforms">
                            {PLATFORMS.map((p) => {
                                const on = picker.platforms.includes(p.id);
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            const next = on ? picker.platforms.filter((x) => x !== p.id) : [...picker.platforms, p.id];
                                            setPicker({ ...picker, platforms: next });
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-md border-2 text-sm font-semibold transition-colors ${on ? "border-[#2563EB] bg-[#DBEAFE]" : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"}`}
                                        data-testid={`platform-${p.id}`}
                                    >
                                        <p.icon size={14} weight="fill" style={{ color: p.color }} />
                                        <span className="text-[#0F172A]">{p.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-[#94A3B8] mt-1.5">LinkedIn/Twitter/Instagram require OAuth — without tokens we record the post as <span className="font-mono">MOCKED</span>. Blog publishes to your hosted /p/{"{slug}"} page. Email blast goes to your active leads.</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setPicker(null)} className="zm-btn-secondary">Cancel</button>
                        <button onClick={onSubmit} className="zm-btn-primary" data-testid="schedule-submit">
                            <CalendarBlank size={14} weight="fill" /> Schedule
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToggleRow({ label, checked, onChange, testid }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 transition-colors text-left"
            data-testid={testid}
        >
            <span className="text-xs font-semibold">{label}</span>
            <span className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? "bg-white" : "bg-white/30"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${checked ? "translate-x-4 bg-[#2563EB]" : "bg-white"}`}></span>
            </span>
        </button>
    );
}
