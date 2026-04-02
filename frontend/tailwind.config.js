/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        ink: {
          950: "#0a0e14",
          900: "#0f1419",
          800: "#1a222d",
          700: "#243040",
        },
        gold: {
          400: "#d4a853",
          500: "#c9a227",
          600: "#a68520",
        },
      },
    },
  },
  plugins: [],
};
