import plugin from "tailwindcss/plugin";

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
				"warning-100": "#DF4343",
				"warning-85": "#E45F5F",
				"warning-10": "#FEF4F5",
				"schwarz-40": "#737373",
				"schwarz-100": "#000000",
				"dunkelblau-200": "#030812",
				"dunkelblau-100": "#0C2753",
				"dunkelblau-90": "#243D64",
				"dunkelblau-80": "#3d5275",
				"dunkelblau-70": "#556887",
				"dunkelblau-60": "#6d7d98",
				"dunkelblau-50": "#8593a9",
				"dunkelblau-40": "#9DA8BA",
				"dunkelblau-30": "#bac2cf",
				"mittelblau-100": "#5F8EC8",
				"mittelblau-70": "#8FB0D8",
				"hellblau-110": "#AEC2D9",
				"hellblau-100": "#B0C8E4",
				"hellblau-60": "#D1DFF0",
				"hellblau-50": "#E1EAF5",
				"hellblau-55": "#D9E4F2",
				"hellblau-40": "#EBF1F9",
				"hellblau-30": "#F5F8FC",
				"aktiv-blau-100": "#0D5DBF",
			},
			borderRadius: {
				"3px": "3px",
				"1.5px": "1.5px",
			},
			boxShadow: {
				"custom-shadow":
					"0 1px 3px 0px var(--tw-shadow-color), 0 1px 3px 0px var(--tw-shadow-color)",
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
				"slide-in-right": {
					"0%": {
						transform: "translateX(100%)",
						opacity: "0",
					},
					"100%": {
						transform: "translateX(0)",
						opacity: "1",
					},
				},
				"fade-out": {
					"0%": {
						opacity: "1",
					},
					"100%": {
						opacity: "0",
					},
				},
				"fade-in": {
					"0%": {
						opacity: "0",
					},
					"100%": {
						opacity: "1",
					},
				},
			},
			animation: {
				"gradient-move": "gradient-move 3s linear infinite",
				"shrink-grow": "shrink-grow 1s ease-in-out infinite",
				"slide-in-right": "slide-in-right 0.3s ease-out",
				"fade-out": "fade-out 0.3s ease-out",
				"fade-in": "fade-in 0.2s ease-in",
				"fade-out-tooltip": "fade-out 0.2s ease-out",
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
				".outline-2px": {
					outlineWidth: "2px",
					outlineColor: "#5F8EC8",
					outlineStyle: "solid",
					outlineOffset: "-2px",
				},
			});
			addVariant("user-invalid", "&:user-invalid");
			addVariant("user-valid", "&:user-valid");
		}),
	],
};
