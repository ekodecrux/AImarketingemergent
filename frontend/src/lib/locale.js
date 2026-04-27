// Locale + currency helpers — single source of truth across the app.
// Locale comes from /api/setup/status or /api/locale/me (cached).

let cachedLocale = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export function setLocaleCache(locale) {
    cachedLocale = locale || null;
    cacheTime = Date.now();
}

export function getCachedLocale() {
    if (cachedLocale && Date.now() - cacheTime < CACHE_TTL) return cachedLocale;
    return null;
}

const FALLBACK = { country_code: "US", currency: "USD", symbol: "$", locale: "en-US" };

export function formatCurrency(amount, localeInfo) {
    const info = localeInfo || cachedLocale || FALLBACK;
    const num = Number(amount) || 0;
    try {
        return new Intl.NumberFormat(info.locale || "en-US", {
            style: "currency",
            currency: info.currency || "USD",
            maximumFractionDigits: num >= 1000 ? 0 : 2,
        }).format(num);
    } catch (_) {
        return `${info.symbol || "$"}${num.toLocaleString()}`;
    }
}

export function formatCurrencyCompact(amount, localeInfo) {
    const info = localeInfo || cachedLocale || FALLBACK;
    const num = Number(amount) || 0;
    try {
        return new Intl.NumberFormat(info.locale || "en-US", {
            style: "currency",
            currency: info.currency || "USD",
            notation: "compact",
            maximumFractionDigits: 1,
        }).format(num);
    } catch (_) {
        return `${info.symbol || "$"}${num.toLocaleString()}`;
    }
}

export function currencySymbol(localeInfo) {
    const info = localeInfo || cachedLocale || FALLBACK;
    return info.symbol || "$";
}
