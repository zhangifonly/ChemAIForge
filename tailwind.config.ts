import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        // 化学科技风品牌色：青蓝主色 + 紫罗兰辅色
        brand: {
          50: "#eafaf7",
          100: "#cdf2ea",
          200: "#9ee5d8",
          300: "#63d2c1",
          400: "#2fb9a6",
          500: "#159c8c",
          600: "#0e7d72",
          700: "#10645d",
          800: "#12504b",
          900: "#13433f",
        },
        accent: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        // 阴影染上品牌青绿色调，而非纯黑，与背景统一
        soft: "0 1px 2px rgba(16,57,52,0.05), 0 10px 30px -14px rgba(14,100,93,0.28)",
        glow: "0 0 0 1px rgba(21,156,140,0.18), 0 10px 30px -8px rgba(21,156,140,0.4)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [typography],
};

export default config;
