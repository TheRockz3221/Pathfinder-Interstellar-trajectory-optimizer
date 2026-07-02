import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        void: "#03050a",
        obsidian: "#080d16",
        orbital: "#0f1b2d",
        cyan: {
          signal: "#44e6ff",
          soft: "#9cf4ff"
        },
        gold: {
          mission: "#f7c948"
        },
        plasma: "#e85888",
        emerald: "#46e6a8"
      },
      boxShadow: {
        glow: "0 0 32px rgba(68, 230, 255, 0.22)",
        gold: "0 0 30px rgba(247, 201, 72, 0.16)"
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "SFMono-Regular", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
