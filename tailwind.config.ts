import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        burgundy: {
          DEFAULT: "#630000",
          dark: "#4a0000",
          light: "#7d0a0a"
        },
        charcoal: "#1B1717",
        soft: "#FDFDFD",
        sunrise: {
          DEFAULT: "#D97904",
          dark: "#b56603"
        },
        coral: {
          DEFAULT: "#D96248",
          dark: "#b84f38"
        },
        "pale-pink": "#F2DFD8",
        gold: {
          DEFAULT: "#E6A742",
          dark: "#c98d2a"
        }
      },
      fontFamily: {
        display: ["\"Playfair Display\"", "Georgia", "serif"],
        body: ["Lora", "Georgia", "serif"],
        ui: ["Manrope", "Inter", "system-ui", "sans-serif"]
      },
      borderRadius: {
        card: "1.25rem",
        "card-lg": "1.5rem",
        control: "0.875rem",
        pill: "999px"
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(27, 23, 23, 0.08), 0 1px 2px -1px rgba(27, 23, 23, 0.06)",
        card: "0 4px 16px -4px rgba(27, 23, 23, 0.10), 0 2px 6px -2px rgba(27, 23, 23, 0.06)",
        "card-hover": "0 10px 28px -8px rgba(99, 0, 0, 0.20), 0 4px 10px -4px rgba(27, 23, 23, 0.08)",
        button: "0 2px 6px -1px rgba(99, 0, 0, 0.30)"
      },
      backgroundImage: {
        "burgundy-gradient": "linear-gradient(135deg, #630000 0%, #7d0a0a 55%, #4a0000 100%)",
        "sunrise-gradient": "linear-gradient(135deg, #D97904 0%, #D96248 100%)",
        "gold-gradient": "linear-gradient(135deg, #E6A742 0%, #D97904 100%)",
        "pink-wash": "linear-gradient(180deg, #F2DFD8 0%, #FDFDFD 100%)"
      },
      keyframes: {
        "lift-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "lift-in": "lift-in 0.2s ease-out"
      }
    }
  },
  plugins: []
};
export default config;
