// Single source of truth for countries → currency mapping. Mirrors backend COUNTRY_CURRENCY in server.py.
// Used by Business Profile country/currency dropdowns and any UI that needs to format money.

export const COUNTRIES = [
    { code: "IN", name: "India", currency: "INR", symbol: "₹" },
    { code: "US", name: "United States", currency: "USD", symbol: "$" },
    { code: "GB", name: "United Kingdom", currency: "GBP", symbol: "£" },
    { code: "AE", name: "United Arab Emirates", currency: "AED", symbol: "AED" },
    { code: "SA", name: "Saudi Arabia", currency: "SAR", symbol: "SAR" },
    { code: "SG", name: "Singapore", currency: "SGD", symbol: "S$" },
    { code: "AU", name: "Australia", currency: "AUD", symbol: "A$" },
    { code: "CA", name: "Canada", currency: "CAD", symbol: "C$" },
    { code: "NZ", name: "New Zealand", currency: "NZD", symbol: "NZ$" },
    { code: "DE", name: "Germany", currency: "EUR", symbol: "€" },
    { code: "FR", name: "France", currency: "EUR", symbol: "€" },
    { code: "IT", name: "Italy", currency: "EUR", symbol: "€" },
    { code: "ES", name: "Spain", currency: "EUR", symbol: "€" },
    { code: "NL", name: "Netherlands", currency: "EUR", symbol: "€" },
    { code: "IE", name: "Ireland", currency: "EUR", symbol: "€" },
    { code: "PT", name: "Portugal", currency: "EUR", symbol: "€" },
    { code: "AT", name: "Austria", currency: "EUR", symbol: "€" },
    { code: "FI", name: "Finland", currency: "EUR", symbol: "€" },
    { code: "BE", name: "Belgium", currency: "EUR", symbol: "€" },
    { code: "GR", name: "Greece", currency: "EUR", symbol: "€" },
    { code: "CH", name: "Switzerland", currency: "CHF", symbol: "CHF" },
    { code: "SE", name: "Sweden", currency: "SEK", symbol: "kr" },
    { code: "NO", name: "Norway", currency: "NOK", symbol: "kr" },
    { code: "DK", name: "Denmark", currency: "DKK", symbol: "kr" },
    { code: "PL", name: "Poland", currency: "PLN", symbol: "zł" },
    { code: "JP", name: "Japan", currency: "JPY", symbol: "¥" },
    { code: "CN", name: "China", currency: "CNY", symbol: "¥" },
    { code: "HK", name: "Hong Kong", currency: "HKD", symbol: "HK$" },
    { code: "KR", name: "South Korea", currency: "KRW", symbol: "₩" },
    { code: "MX", name: "Mexico", currency: "MXN", symbol: "Mex$" },
    { code: "BR", name: "Brazil", currency: "BRL", symbol: "R$" },
    { code: "AR", name: "Argentina", currency: "ARS", symbol: "AR$" },
    { code: "CL", name: "Chile", currency: "CLP", symbol: "CL$" },
    { code: "CO", name: "Colombia", currency: "COP", symbol: "Col$" },
    { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R" },
    { code: "NG", name: "Nigeria", currency: "NGN", symbol: "₦" },
    { code: "EG", name: "Egypt", currency: "EGP", symbol: "E£" },
    { code: "KE", name: "Kenya", currency: "KES", symbol: "KSh" },
    { code: "IL", name: "Israel", currency: "ILS", symbol: "₪" },
    { code: "TR", name: "Turkey", currency: "TRY", symbol: "₺" },
    { code: "RU", name: "Russia", currency: "RUB", symbol: "₽" },
    { code: "ID", name: "Indonesia", currency: "IDR", symbol: "Rp" },
    { code: "TH", name: "Thailand", currency: "THB", symbol: "฿" },
    { code: "MY", name: "Malaysia", currency: "MYR", symbol: "RM" },
    { code: "PH", name: "Philippines", currency: "PHP", symbol: "₱" },
    { code: "VN", name: "Vietnam", currency: "VND", symbol: "₫" },
    { code: "PK", name: "Pakistan", currency: "PKR", symbol: "₨" },
    { code: "BD", name: "Bangladesh", currency: "BDT", symbol: "৳" },
    { code: "LK", name: "Sri Lanka", currency: "LKR", symbol: "Rs" },
];

// Common currencies (a country may use a non-default currency, e.g. Indian SaaS pricing in USD).
// Lets users override the auto-derived currency.
export const CURRENCY_OPTIONS = [
    "INR", "USD", "EUR", "GBP", "AED", "SAR", "SGD", "AUD", "CAD",
    "JPY", "CNY", "KRW", "CHF", "SEK", "NOK", "DKK", "PLN", "MXN",
    "BRL", "ZAR", "NGN", "ILS", "TRY", "IDR", "THB", "MYR", "PHP",
    "PKR", "BDT", "LKR", "RUB", "VND",
];

export function countryByCode(code) {
    return COUNTRIES.find((c) => c.code === (code || "").toUpperCase());
}

export function defaultCurrencyFor(countryCode) {
    return countryByCode(countryCode)?.currency || "USD";
}

export function symbolFor(currency) {
    const c = COUNTRIES.find((x) => x.currency === currency);
    return c?.symbol || currency || "$";
}
