import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
	page: {
		padding: 64,
		fontSize: 12,
		fontFamily: "Times-Roman",
	},
	paragraph: { marginBottom: 8, wordBreak: "break-word" },
	bold: { fontWeight: "bold" },
	italic: { fontStyle: "italic" },
	link: { color: "#0C2753", textDecoration: "underline" },
	inlineCode: {
		backgroundColor: "#F5F8FC", // hellblau-30
		padding: 2,
		fontFamily: "Courier",
		fontSize: 11,
	},
	codeBlock: {
		backgroundColor: "#F5F8FC", // hellblau-30
		padding: 8,
		fontFamily: "Courier",
		fontSize: 10,
		marginBottom: 8,
	},
	h1: { fontSize: 22, fontWeight: "bold", marginBottom: 6 },
	h2: { fontSize: 20, fontWeight: "bold", marginBottom: 6 },
	h3: { fontSize: 18, fontWeight: "bold", marginBottom: 6 },
	h4: { fontSize: 16, fontWeight: "bold", marginBottom: 6 },
	h5: { fontSize: 14, fontWeight: "bold", marginBottom: 6 },
	h6: { fontSize: 12, fontWeight: "bold", marginBottom: 6 },
	list: { marginBottom: 8 },
	listItem: { flexDirection: "row", marginBottom: 2 },
	listItemBullet: { width: 12 },
	blockquote: {
		borderLeftWidth: 3,
		borderLeftColor: "#0C2753", // dunkelblau-100
		paddingLeft: 8,
		marginBottom: 8,
		color: "#3d5275", //dunkelblau-80
	},
	table: {
		width: "auto",
		marginBottom: 16,
		marginTop: 16,
		borderWidth: 0.5,
	},
	tableRow: { flexDirection: "row" },
	tableCell: {
		flex: 1,
		borderWidth: 0.5,
		borderColor: "#000",
		padding: 4,
		backgroundColor: "transparent",
	},
	tableCellText: {
		wordWrap: "break-word",
		whiteSpace: "normal",
	},
	tableHeader: {
		fontWeight: "bold",
		backgroundColor: "#F5F8FC",
	},
});
