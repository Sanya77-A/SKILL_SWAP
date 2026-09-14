/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Avenir Next", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
        heading: ["Avenir Next", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        "surface-2": "var(--color-surface-2)",
        border: "var(--color-border)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        accent: "var(--color-accent)",
        "accent-hover": "var(--color-accent-hover)",
        "on-accent": "var(--color-on-accent)",
        "accent-2": "var(--color-accent-2)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        glass: "var(--shadow-raised)",
      },
      transitionDuration: {
        200: "200ms",
        250: "250ms",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
    },
  },
  plugins: [],
};
