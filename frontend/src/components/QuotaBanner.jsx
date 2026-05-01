import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Lightning, Warning, X } from "@phosphor-icons/react";

const DISMISS_KEY = "zm.quota_banner_dismissed_until";

export default function QuotaBanner() {
    const [data, setData] = useState(null);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const dismissedUntil = parseInt(sessionStorage.getItem(DISMISS_KEY) || "0");
        if (dismissedUntil > Date.now()) { setHidden(true); return; }

        api.get("/quota/status").then((r) => setData(r.data)).catch(() => {});
        const t = setInterval(() => {
            api.get("/quota/status").then((r) => setData(r.data)).catch(() => {});
        }, 60000);
        return () => clearInterval(t);
    }, []);

    if (hidden || !data) return null;
    if (!data.warn && !data.blocked) return null;

    const dismiss = () => {
        // Hide for 30 minutes
        sessionStorage.setItem(DISMISS_KEY, String(Date.now() + 30 * 60 * 1000));
        setHidden(true);
    };

    if (data.blocked) {
        return (
            <div className="zm-card p-4 mb-4 border-l-4 border-[#DC2626] bg-[#FEF2F2] flex items-start justify-between gap-3" data-testid="quota-banner-blocked">
                <div className="flex items-start gap-3">
                    <Warning size={20} weight="fill" className="text-[#DC2626] mt-0.5" />
                    <div>
                        <p className="font-bold text-[#991B1B] text-sm">AI quota exhausted ({data.used_in_last_hour}/{data.limit_per_hour} this hour)</p>
                        <p className="text-xs text-[#7F1D1D] mt-0.5">New plans, content, and Co-Pilot actions are paused until your quota resets or you upgrade.</p>
                    </div>
                </div>
                <Link to="/billing" className="zm-btn-primary text-xs py-2 shrink-0 bg-[#DC2626]" data-testid="quota-banner-upgrade">
                    <Lightning size={12} weight="fill" /> Upgrade plan
                </Link>
            </div>
        );
    }

    return (
        <div className="zm-card p-4 mb-4 border-l-4 border-[#F59E0B] bg-[#FFFBEB] flex items-start justify-between gap-3" data-testid="quota-banner-warn">
            <div className="flex items-start gap-3">
                <Warning size={18} weight="fill" className="text-[#F59E0B] mt-0.5" />
                <div>
                    <p className="font-bold text-[#92400E] text-sm">AI quota at {data.percent_used_hour}% — {data.limit_per_hour - data.used_in_last_hour} calls left this hour</p>
                    <p className="text-xs text-[#78350F] mt-0.5">Upgrade for higher limits, or wait for reset.</p>
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <Link to="/billing" className="zm-btn-secondary text-xs py-1.5" data-testid="quota-banner-topup">
                    Top up
                </Link>
                <button onClick={dismiss} className="text-[#92400E]/60 hover:text-[#92400E] p-1" data-testid="quota-banner-dismiss" aria-label="Dismiss">
                    <X size={14} weight="bold" />
                </button>
            </div>
        </div>
    );
}
