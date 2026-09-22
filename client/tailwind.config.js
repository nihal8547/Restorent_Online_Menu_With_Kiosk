/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#e11d48",
          dark: "#be123c",
          light: "#fda4af",
        },
      },
    },
  },
  plugins: [],
};
