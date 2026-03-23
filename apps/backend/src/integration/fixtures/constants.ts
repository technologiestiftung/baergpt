import { resolve } from "path";

export const defaultDocumentName = "default_document.pdf";
export const defaultDocumentPath = resolve(
	process.cwd(),
	`./src/integration/fixtures/${defaultDocumentName}`,
);

// defaultDocument data for `documents` table
export const file_checksum = "8f846168ffdef7b234d20c330eb99260";
export const file_size = 36884;
export const num_pages = 1;
export const folder_id = null;
export const created_at = new Date().toISOString();
export const processing_finished_at = new Date().toISOString();

// defaultDocument data for `document_summaries`table
export const summary = `**Zusammenfassung:**

Das Dokument "UI Test Doc" enthält einen Platzhaltext (Lorem Ipsum), der typischerweise in der Druck- und Designbranche verwendet wird, um Layouts zu testen. Der Text selbst hat keine inhaltliche Bedeutung und dient lediglich als Platzhalter. Er beginnt mit den bekannten Worten "Lorem ipsum dolor sit amet" und setzt sich mit weiteren lateinisch anmutenden Wörtern fort, die keinen sinnvollen Inhalt tragen. Der Text dient dazu, die visuelle Darstellung und das Layout von Dokumenten oder Benutzeroberflächen zu überprüfen, ohne dass der eigentliche Inhalt ablenkt.`;
export const tags = [
	"UI Test Doc",
	"Lorem ipsum",
	"Dolor sit amet",
	"Consetetur",
	"Sadipscing",
	"Elitr",
	"Diam",
	"Nonumy",
	"Eirmod",
	"Tempor",
];
export const short_summary = `Lorem Ipsum Platzhaltertext`;
export const chunk_mistral_embedding = Array(1024).fill(0.0001);

// defaultDocument data for `document_chunks` table
export const content = `# UI Test Doc 
 Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.`;
export const page = 1;
export const chunk_index = 0;
