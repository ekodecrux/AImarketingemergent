import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import LandingPagePreview from "@/components/LandingPagePreview";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function PublicLandingPage() {
    const { slug } = useParams();
    const [page, setPage] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/public/p/${slug}`)
            .then((r) => {
                setPage(r.data.page);
                if (r.data.page.seo_title) document.title = r.data.page.seo_title;
            })
            .catch((err) => setError(err.response?.status === 404 ? "Page not found" : "Failed to load"));
    }, [slug]);

    const submit = async (data) => {
        try {
            const r = await axios.post(`${BACKEND_URL}/api/public/p/${slug}/submit`, data);
            toast.success(r.data.message || "Submitted");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Submission failed");
            throw err;
        }
    };

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
            <div className="text-center">
                <p className="zm-section-label mb-2">// {error.toLowerCase()}</p>
                <h1 className="font-display text-4xl font-black tracking-tighter">{error}</h1>
            </div>
        </div>
    );
    if (!page) return <div className="min-h-screen flex items-center justify-center text-sm text-[#71717A]">Loading…</div>;

    return (
        <div className="min-h-screen bg-white">
            <LandingPagePreview page={page} isPublic={true} onSubmit={submit} />
            <footer className="px-4 sm:px-6 lg:px-8 py-6 text-center bg-[#0F172A] text-white/60 text-xs uppercase tracking-[0.2em] font-semibold">
                Built with ZeroMark AI
            </footer>
        </div>
    );
}
