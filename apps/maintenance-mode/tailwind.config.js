/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				"schwarz-100": "#000000",
				"dunkelblau-100": "#0C2753",
				"dunkelblau-80": "#3D5275",
				"hellblau-30": "#F5F8FC",
			},
			fontFamily: {
				arial: ["Arial"],
			},
		},
	},
	plugins: [],
};
