export default function PageHeader({ eyebrow, title, subtitle, action }) {
    return (
        <div className="px-8 pt-10 pb-6 border-b border-[#E2E8F0] bg-white">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    {eyebrow && <p className="zm-section-label mb-2">{eyebrow}</p>}
                    <h1 className="font-display text-4xl md:text-5xl font-black tracking-tighter leading-none" data-testid="page-title">{title}</h1>
                    {subtitle && <p className="text-sm text-[#71717A] mt-2">{subtitle}</p>}
                </div>
                {action && <div>{action}</div>}
            </div>
        </div>
    );
}
