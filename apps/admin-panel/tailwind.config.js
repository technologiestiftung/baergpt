import plugin from "tailwindcss/plugin";
import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				orange: "#E69736",
				mittelgruen: "#4CA786",
				"berlin-rot": "#E40521",
				"schwarz-40": "#737373",
				"dunkelblau-200": "#030812",
				"dunkelblau-100": "#0C2753",
				"dunkelblau-80": "#3d5275",
				"dunkelblau-70": "#556887",
				"dunkelblau-60": "#6d7d98",
				"dunkelblau-50": "#8593a9",
				"dunkelblau-40": "#9DA8BA",
				"dunkelblau-30": "#bac2cf",
				"mittelblau-100": "#5F8EC8",
				"hellblau-100": "#B0C8E4",
				"hellblau-60": "#D1DFF0",
				"hellblau-50": "#E1EAF5",
				"hellblau-30": "#F5F8FC",

				// Shadcn UI colors
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary))",
					foreground: "hsl(var(--primary-foreground))",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				chart: {
					1: "hsl(var(--chart-1))",
					2: "hsl(var(--chart-2))",
					3: "hsl(var(--chart-3))",
					4: "hsl(var(--chart-4))",
					5: "hsl(var(--chart-5))",
				},
				sidebar: {
					DEFAULT: "hsl(var(--sidebar-background))",
					foreground: "hsl(var(--sidebar-foreground))",
					primary: "hsl(var(--sidebar-primary))",
					"primary-foreground": "hsl(var(--sidebar-primary-foreground))",
					accent: "hsl(var(--sidebar-accent))",
					"accent-foreground": "hsl(var(--sidebar-accent-foreground))",
					border: "hsl(var(--sidebar-border))",
					ring: "hsl(var(--sidebar-ring))",
				},
			},
			borderRadius: {
				"3px": "3px",
				"1.5px": "1.5px",
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},

			keyframes: {
				shimmer: {
					"100%": {
						transform: "translateX(100%)",
					},
				},
				"gradient-move": {
					"0%": {
						backgroundPosition: "200% 0%",
					},
					"100%": {
						backgroundPosition: "-200% 0%",
					},
				},
				"shrink-grow": {
					"0%": {
						transform: "scale(1)",
					},
					"50%": {
						transform: "scale(0.6)",
					},
					"100%": {
						transform: "scale(1)",
					},
				},
			},
			animation: {
				"gradient-move": "gradient-move 3s linear infinite",
				"shrink-grow": "shrink-grow 1s ease-in-out infinite",
			},
			fontFamily: {
				arial: ["Arial"],
			},
		},
	},
	plugins: [
		plugin(function ({ addComponents, addVariant }) {
			addComponents({
				".outline-default": {
					outlineWidth: "3px",
					outlineColor: "#5F8EC8",
					outlineStyle: "solid",
				},
			});
			addVariant("user-invalid", "&:user-invalid");
			addVariant("user-valid", "&:user-valid");
		}),
		tailwindcssAnimate,
	],
};
