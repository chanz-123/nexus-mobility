/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        grab: {
          green: "#00B14F",
          darkGreen: "#008A3D",
          lightGreen: "#E6F8EE",
          black: "#0F172A",
          gray: "#475569",
          lightGray: "#F1F5F9",
        },
      },
    },
  },
  plugins: [],
};
