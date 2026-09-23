/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
        brand: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#e11d48",
          dark: "#be123c",
          light: "#fda4af",
        },
        ink: {
          DEFAULT: "#141013",
          soft: "#1f181c",
        },
        cream: "#f7ede2",
        gold: "#c9a227",
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(20, 16, 19, 0.25)",
        card: "0 2px 20px -8px rgba(20, 16, 19, 0.15)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};
