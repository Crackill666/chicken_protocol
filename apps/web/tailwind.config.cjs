export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        barn: {
          50: "#fff8ef",
          100: "#fde8cb",
          200: "#f9d08e",
          300: "#f4b86a",
          400: "#e88f4c",
          500: "#cc6e2f",
          600: "#9f5124",
          700: "#6f351f",
          800: "#41201a",
          900: "#24120f"
        }
      },
      fontFamily: {
        display: ["'Bree Serif'", "serif"],
        body: ["'Nunito Sans'", "sans-serif"]
      },
      keyframes: {
        bounceSoft: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" }
        },
        flicker: {
          "0%, 100%": { opacity: "0.7" },
          "50%": { opacity: "1" }
        },
        pulseSoft: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.8" },
          "50%": { transform: "scale(1.03)", opacity: "1" }
        }
      },
      animation: {
        bounceSoft: "bounceSoft 2.4s ease-in-out infinite",
        flicker: "flicker 1.4s ease-in-out infinite",
        pulseSoft: "pulseSoft 1.8s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
