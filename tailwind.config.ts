import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0a0b",
          surface: "#111114",
          elevated: "#17171c",
          subtle: "#1d1d24",
        },
        border: {
          subtle: "#26262e",
          DEFAULT: "#2e2e38",
          strong: "#3a3a46",
        },
        text: {
          primary: "#e8e8ea",
          secondary: "#a0a0aa",
          muted: "#6c6c78",
        },
        accent: {
          DEFAULT: "#7c5cff",
          hover: "#8e72ff",
          subtle: "#7c5cff20",
        },
        status: {
          idle: "#6c6c78",
          ready: "#3aa6ff",
          running: "#f5a623",
          success: "#34c759",
          error: "#ff4d6d",
          paused: "#b58fff",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fadeIn 200ms ease-out",
      },
      keyframes: {
        slideUp: {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
