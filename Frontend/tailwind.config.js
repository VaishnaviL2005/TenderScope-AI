/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef2f9", 100: "#d9e1f0", 200: "#b3c3e1", 300: "#8aa2cf", 400: "#5d7cb8",
          500: "#3b5b9c", 600: "#2b467f", 700: "#213766", 800: "#182a4f", 900: "#0f1c38", 950: "#0a1328",
        },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
