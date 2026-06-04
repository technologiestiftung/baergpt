import { Font } from "@react-pdf/renderer";

let fontsRegistered = false;

export function registerPdfFonts() {
	if (fontsRegistered) {
		return;
	}

	try {
		Font.register({
			family: "Berlin Type Office",
			fonts: [
				{ src: "/fonts/BerlinTypeOffice-Regular.ttf", fontWeight: 400 },
				{ src: "/fonts/BerlinTypeOffice-Bold.ttf", fontWeight: 700 },
				{
					src: "/fonts/BerlinTypeOffice-Regular.ttf",
					fontStyle: "italic",
					fontWeight: 400,
				},
				{
					src: "/fonts/BerlinTypeOffice-Bold.ttf",
					fontStyle: "italic",
					fontWeight: 700,
				},
			],
		});
		fontsRegistered = true;
	} catch (error) {
		console.error("Failed to register PDF export fonts:", error);
		throw error;
	}
}
