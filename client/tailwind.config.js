const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Kanit"', '"Inter"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        accent: {
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
        },
        success: {
          400: "#34D399",
          500: "#10B981",
        },
        danger: {
          400: "#FB7185",
          500: "#F43F5E",
        },
      },
    },
  },
  plugins: [],
};
