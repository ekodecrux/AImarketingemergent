import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { CheckCircle, XCircle, ArrowsClockwise } from "@phosphor-icons/react";

export default function Scraping() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
        api.get("/scraping/jobs").then((r) => setJobs(r.data.jobs)).finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);

    return (
        <div>
            <PageHeader
                eyebrow="// Discovery engine"
                title="Scrape Jobs"
                subtitle={`${jobs.length} job${jobs.length === 1 ? "" : "s"} executed`}
                action={<button className="zm-btn-secondary" onClick={load} data-testid="refresh-jobs"><ArrowsClockwise size={14} weight="bold"/> Refresh</button>}
            />
            <div className="px-8 py-6">
                <div className="bg-white border border-[#EDE5D4] p-6 mb-6 border-l-2 border-l-[#FF562D]">
                    <p className="zm-section-label mb-2">// How it works</p>
                    <p className="text-sm text-[#71717A] leading-relaxed">
                        Trigger scrape jobs from <span className="font-bold text-[#0E0F11]">Leads → Scrape</span>. Discovered leads
                        are auto-imported into your pipeline tagged with their source. Powered by Groq AI to generate research-grade lead data.
                    </p>
                </div>

                <div className="zm-card overflow-x-auto" data-testid="scraping-jobs-table">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#EDE5D4]">
                                <th className="text-left px-4 py-3 zm-section-label">Type</th>
                                <th className="text-left px-4 py-3 zm-section-label">Params</th>
                                <th className="text-left px-4 py-3 zm-section-label">Status</th>
                                <th className="text-left px-4 py-3 zm-section-label">Results</th>
                                <th className="text-left px-4 py-3 zm-section-label">Started</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <tr><td colSpan={5} className="px-4 py-12 text-center text-[#A1A1AA]">Loading…</td></tr>}
                            {!loading && jobs.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-[#A1A1AA]">No jobs yet</td></tr>}
                            {jobs.map((j) => (
                                <tr key={j.id} className="border-b border-[#EDE5D4] last:border-b-0">
                                    <td className="px-4 py-3 font-mono text-xs">{j.type}</td>
                                    <td className="px-4 py-3 text-[#71717A] text-xs">
                                        {j.params?.keyword || j.params?.website} {j.params?.location && `· ${j.params.location}`}
                                    </td>
                                    <td className="px-4 py-3">
                                        {j.status === "COMPLETED" && <span className="zm-badge bg-[#10B981] text-white inline-flex items-center gap-1"><CheckCircle size={10} weight="fill" /> Done</span>}
                                        {j.status === "FAILED" && <span className="zm-badge bg-[#E32636] text-white inline-flex items-center gap-1"><XCircle size={10} weight="fill" /> Failed</span>}
                                        {j.status === "PROCESSING" && <span className="zm-badge bg-[#F59E0B] text-white">Running</span>}
                                    </td>
                                    <td className="px-4 py-3 font-mono">{j.result_count ?? "—"}</td>
                                    <td className="px-4 py-3 text-[#71717A] text-xs">{new Date(j.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
