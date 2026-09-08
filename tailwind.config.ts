import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#eef0ff",
          100: "#e0e3fe",
          200: "#c6cafd",
          300: "#a5abfb",
          400: "#8388f6",
          500: "#6366f1",
          600: "#4f52d6",
          700: "#4143ad",
          800: "#363889",
          900: "#2f306e",
        },
        surface: "#ffffff",
        canvas: "#f4f5fb",
        ink: "#14162b",
        muted: "#6b7086",
        line: "#e9eaf3",
      },
      borderRadius: {
        xl2: "18px",
        xl3: "24px",
      },
      boxShadow: {
        soft: "0 8px 24px -6px rgba(26,27,46,0.08), 0 1px 4px rgba(26,27,46,0.04)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;