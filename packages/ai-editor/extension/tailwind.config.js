/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,tsx,ts}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        qingwu: {
          50: "#f0fdf9",
          100: "#ccfbef",
          200: "#99f6e0",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d5dae2",
          300: "#b0b9c8",
          400: "#8591a6",
          500: "#66728a",
          600: "#515b71",
          700: "#43495c",
          800: "#3a3f4f",
          900: "#1e2230",
          950: "#13161f",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "PingFang SC",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Cascadia Code", "Consolas", "monospace"],
      },
      boxShadow: {
        soft: "0 2px 12px 0 rgba(20, 30, 50, 0.08)",
        pop: "0 8px 32px -4px rgba(20, 30, 50, 0.18)",
        glow: "0 0 0 1px rgba(20, 184, 166, 0.2), 0 4px 16px -2px rgba(20, 184, 166, 0.3)",
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "slide-up": "slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down": "slide-down 0.18s ease-out",
        "scale-in": "scale-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.4s linear infinite",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
