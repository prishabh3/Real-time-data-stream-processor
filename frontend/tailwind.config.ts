import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "IBM Plex Mono",
          "Fira Code",
          "Cascadia Code",
          "monospace",
        ],
      },
      colors: {
        // Surface layers
        surface: {
          0: "#0d0f12",
          1: "#111318",
          2: "#1a1d23",
          3: "#252930",
          4: "#2e3340",
        },
        // Text hierarchy
        text: {
          primary: "#e2e8f0",
          secondary: "#94a3b8",
          muted: "#64748b",
          faint: "#374151",
        },
        // Functional accents
        buy: "#22c55e",
        sell: "#ef4444",
        accent: "#3b82f6",
        warning: "#f59e0b",
        // Semantic
        bullish: "#22c55e",
        bearish: "#ef4444",
      },
      animation: {
        "flash-up": "flash-up 0.4s ease-out",
        "flash-down": "flash-down 0.4s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      spacing: {
        "0.5": "2px",
        "1": "4px",
        "1.5": "6px",
      },
    },
  },
  plugins: [],
};

export default config;
