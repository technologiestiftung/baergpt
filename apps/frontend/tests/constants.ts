import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const defaultBucketName = "documents";

export const defaultUserPassword = "123456789!";
export const defaultUserFirstName = "john";
export const defaultUserLastName = "doe";
export const defaultUserEmail = `${defaultUserFirstName}.${defaultUserLastName}@local.berlin.de`;

export const defaultDocumentName = "default_document.pdf";
export const seedDefaultDocumentName = "BaerGPT-Handbuch.pdf";
export const defaultDocumentPath = resolve(
	__dirname,
	`./fixtures/${defaultDocumentName}`,
);

export const defaultDocuments = [
	{
		name: "default_document_1.pdf",
		path: resolve(__dirname, "./fixtures/default_document_1.pdf"),
	},
	{
		name: "default_document_2.pdf",
		path: resolve(__dirname, "./fixtures/default_document_2.pdf"),
	},
	{
		name: "default_document_3.pdf",
		path: resolve(__dirname, "./fixtures/default_document_3.pdf"),
	},
	{
		name: "default_document_4.pdf",
		path: resolve(__dirname, "./fixtures/default_document_4.pdf"),
	},
	{
		name: "default_document_5.pdf",
		path: resolve(__dirname, "./fixtures/default_document_5.pdf"),
	},
	{
		name: "default_document_6.pdf",
		path: resolve(__dirname, "./fixtures/default_document_6.pdf"),
	},
];
export const defaultDocumentsType = "application/pdf";

// defaultDocument data for `documents` table
export const defaultSourceType = "personal_document";
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

// defaultDocument data for `document_chunks` table
export const content = `# UI Test Doc 
 Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.`;
export const page = 1;
export const chunk_index = 0;

export const chunk_mistral_embedding = Array(1024).fill(0.0001);

export const secondaryDocumentName = "secondary_document.pdf";
export const secondaryDocumentPath = resolve(
	__dirname,
	`./fixtures/${secondaryDocumentName}`,
);
export const secondaryDocumentType = "application/pdf";

export const msWordDocumentName = "ms-word-document.docx";
export const msWordDocumentPath = resolve(
	__dirname,
	`./fixtures/${msWordDocumentName}`,
);
export const msWordDocumentType =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const msExcelDocumentName = "ms-excel-document.xlsx";
export const msExcelDocumentPath = resolve(
	__dirname,
	`./fixtures/${msExcelDocumentName}`,
);
export const msExcelDocumentType =
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const longFileName =
	"This_is_a_very_long_document_name_that_should_be_truncated.pdf";
export const longFilePath = resolve(__dirname, `./fixtures/${longFileName}`);

export const VERSION_STORAGE_KEY = "last-seen-version";
