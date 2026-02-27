/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-strong": "var(--color-primary-strong)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        "text-main": "var(--text-main)",
        "text-muted": "var(--text-muted-3)",
        "border-soft": "var(--border-soft)",
        "surface-card": "var(--surface-card)",
        "surface-solid": "var(--surface-card-solid)",
      },
    },
  },
  plugins: [],
};
