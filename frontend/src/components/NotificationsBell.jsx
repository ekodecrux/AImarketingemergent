import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Bell, ShieldCheck, Sparkle } from "@phosphor-icons/react";

export default function NotificationsBell() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const ref = useRef(null);

    const load = () => {
        api.get("/notifications").then((r) => {
            setItems(r.data.notifications || []);
            setUnread(r.data.unread_count || 0);
        }).catch(() => {});
    };

    useEffect(() => {
        load();
        const t = setInterval(load, 60000); // poll every 60s
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const markRead = async (id) => {
        await api.post(`/notifications/${id}/read`).catch(() => {});
        load();
    };

    const markAll = async () => {
        await api.post(`/notifications/mark-all-read`).catch(() => {});
        load();
    };

    const fmtTime = (iso) => {
        const d = new Date(iso);
        const diff = (Date.now() - d.getTime()) / 1000;
        if (diff < 60) return "just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return d.toLocaleDateString();
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(!open)}
                className="p-2 hover:bg-[#F8FAFC] rounded-xl text-[#52525B] hover:text-[#0F172A] transition-colors relative"
                data-testid="notifications-bell"
                aria-label="Notifications"
            >
                <Bell size={18} weight="bold" />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#2563EB] rounded-full flex items-center justify-center" data-testid="notifications-badge">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_8px_24px_rgba(14,15,17,0.08)] z-50 overflow-hidden" data-testid="notifications-panel">
                    <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#71717A]">Notifications</p>
                        {unread > 0 && (
                            <button onClick={markAll} className="text-xs text-[#2563EB] font-bold hover:underline" data-testid="notifications-mark-all">
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <Bell size={28} weight="bold" className="mx-auto mb-3 text-[#A1A1AA]" />
                                <p className="text-sm text-[#71717A]">All caught up — no notifications yet.</p>
                            </div>
                        ) : items.map((n) => {
                            const isHigh = n.severity === "high";
                            return (
                                <Link
                                    key={n.id}
                                    to={n.link || "/dashboard"}
                                    onClick={() => { markRead(n.id); setOpen(false); }}
                                    className={`block px-4 py-3 border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#F8FAFC] transition-colors ${!n.read ? "bg-[#EFF6FF]" : ""}`}
                                    data-testid={`notification-${n.id}`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${isHigh ? "bg-[#DBEAFE]" : "bg-[#F8FAFC]"}`}>
                                            {isHigh ? (
                                                <ShieldCheck size={14} weight="fill" className="text-[#2563EB]" />
                                            ) : (
                                                <Sparkle size={14} weight="fill" className="text-[#10B981]" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-bold leading-snug">{n.title}</p>
                                                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mt-1.5 shrink-0"></span>}
                                            </div>
                                            <p className="text-xs text-[#52525B] mt-1 leading-relaxed line-clamp-2">{n.body}</p>
                                            <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-[#A1A1AA] mt-1.5">{fmtTime(n.created_at)}</p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
