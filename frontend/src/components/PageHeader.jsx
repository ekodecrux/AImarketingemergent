export default function PageHeader({ eyebrow, title, subtitle, action }) {
    return (
        <div className="px-4 sm:px-6 lg:px-8 pt-6 lg:pt-10 pb-5 lg:pb-6 border-b border-[#E2E8F0] bg-white">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div className="min-w-0">
                    {eyebrow && <p className="zm-section-label mb-2">{eyebrow}</p>}
                    <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight" data-testid="page-title">{title}</h1>
                    {subtitle && <p className="text-sm text-[#64748B] mt-2">{subtitle}</p>}
                </div>
                {action && <div className="flex flex-wrap gap-2 md:flex-shrink-0">{action}</div>}
            </div>
        </div>
    );
}
