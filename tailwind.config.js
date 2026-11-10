/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // skala abu NETRAL (tanpa rona) agar warna foto dinilai akurat; nilai per tema ada di index.css
      colors: {
        ink: {
          950: v("ink-950"),
          900: v("ink-900"),
          850: v("ink-850"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
          500: v("ink-500"),
          400: v("ink-400"),
          300: v("ink-300"),
          200: v("ink-200"),
          100: v("ink-100"),
        },
        stage: v("stage"),
        accent: { DEFAULT: v("accent"), deep: v("accent-deep"), soft: "rgb(var(--accent) / 0.16)" },
        "on-accent": v("on-accent"),
      },
      fontFamily: {
        ui: ['"Segoe UI Variable Text"', '"Segoe UI"', "system-ui", "sans-serif"],
        display: ["Bahnschrift", '"Segoe UI Variable Display"', '"Segoe UI"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
