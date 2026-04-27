import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { ChartBar, Lightning, GpsFix } from "@phosphor-icons/react";

const REPORT_TYPES = [
    { v: "LEAD_PERFORMANCE", label: "Lead Performance", icon: ChartBar, desc: "Sources, statuses, throughput." },
    { v: "CAMPAIGN_PERFORMANCE", label: "Campaign Performance", icon: Lightning, desc: "Sent, failed, by channel." },
    { v: "GAP_ANALYSIS", label: "Gap Analysis", icon: GpsFix, desc: "Distance to monthly targets + AI suggestions." },
];

export default function Reports() {
    const [reports, setReports] = useState([]);
    const [periodDays, setPeriodDays] = useState(30);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(null);

    const load = () => {
        api.get("/reports").then((r) => setReports(r.data.reports));
    };
    useEffect(() => { load(); }, []);

    const generate = async (type) => {
        setLoading(true);
        try {
            const r = await api.post("/reports/generate", { type, period_days: periodDays });
            toast.success("Report generated");
            setActive(r.data.report);
            load();
        } catch (err) {
            toast.error("Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <PageHeader eyebrow="// Insights" title="Reports" subtitle="On-demand performance and gap analysis reports." />
            <div className="px-8 py-6">
                <div className="flex items-center gap-3 mb-6">
                    <span className="zm-section-label">Period</span>
                    <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))} className="zm-input w-auto" data-testid="report-period">
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-0 zm-card mb-8" data-testid="report-types">
                    {REPORT_TYPES.map((t, i) => (
                        <div key={t.v} className={`p-6 ${i < 2 ? "md:border-r border-b md:border-b-0" : ""} border-[#EDE5D4]`}>
                            <t.icon size={24} weight="bold" className="mb-3" />
                            <h3 className="font-display text-lg font-bold tracking-tight">{t.label}</h3>
                            <p className="text-xs text-[#71717A] mt-1 mb-4">{t.desc}</p>
                            <button disabled={loading} onClick={() => generate(t.v)} className="zm-btn-primary w-full" data-testid={`generate-${t.v}`}>
                                {loading ? "Generating…" : "Generate"}
                            </button>
                        </div>
                    ))}
                </div>

                {active && (
                    <div className="zm-card p-6 mb-6" data-testid="report-active">
                        <p className="zm-section-label">// Latest report</p>
                        <h3 className="font-display text-2xl font-bold tracking-tight mt-1 mb-4">{active.type.replace(/_/g, " ")}</h3>
                        <pre className="bg-[#FAF7F2] border-l-2 border-[#FF562D] p-4 text-xs overflow-x-auto font-mono">{JSON.stringify(active.data, null, 2)}</pre>
                    </div>
                )}

                <h2 className="font-display text-2xl font-bold tracking-tight mb-4">History</h2>
                <div className="zm-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#EDE5D4]">
                                <th className="text-left px-4 py-3 zm-section-label">Type</th>
                                <th className="text-left px-4 py-3 zm-section-label">Period</th>
                                <th className="text-left px-4 py-3 zm-section-label">Generated</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-12 text-center text-[#A1A1AA]">No reports generated</td></tr>
                            )}
                            {reports.map((r) => (
                                <tr key={r.id} className="border-b border-[#EDE5D4] last:border-b-0">
                                    <td className="px-4 py-3 font-semibold">{r.type.replace(/_/g, " ")}</td>
                                    <td className="px-4 py-3 text-[#71717A]">
                                        {new Date(r.period_start).toLocaleDateString()} → {new Date(r.period_end).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-[#71717A]">{new Date(r.generated_at).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => setActive(r)} className="text-[#FF562D] text-xs uppercase tracking-[0.15em] font-bold hover:underline">View</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
