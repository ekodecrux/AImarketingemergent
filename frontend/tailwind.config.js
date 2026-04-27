/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Source Sans 3"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
                display: ['"Fraunces"', '"Source Sans 3"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'serif'],
            },
            borderRadius: {
                lg: '12px',
                md: '8px',
                sm: '6px',
                '2xl': '20px',
                '3xl': '28px',
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
                popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
                primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
                secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
                muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
                accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
                destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                brand: {
                    coral: '#FF562D',
                    coralDark: '#E04416',
                    coralLight: '#FFE6DC',
                    ink: '#0E0F11',
                    cream: '#FAF7F2',
                    sand: '#EDE5D4',
                    teal: '#0FB39A',
                    yellow: '#FFD300',
                },
                chart: {
                    '1': 'hsl(var(--chart-1))', '2': 'hsl(var(--chart-2))', '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))', '5': 'hsl(var(--chart-5))'
                }
            },
            boxShadow: {
                'brand-pop': '0 2px 0 0 #0E0F11',
                'brand-pop-lg': '0 4px 0 0 #0E0F11',
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
};
