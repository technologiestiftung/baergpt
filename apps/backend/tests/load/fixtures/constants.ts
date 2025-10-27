// Local urls / keys
// todo: Change them to use the prod/staging environments
export const API_URL = "http://localhost:3000";
export const SUPABASE_URL = "http://localhost:54321";
export const SUPABASE_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Local test user credentials
// todo: Change them if needed (make sure the user exists in your test database)
export const email = "admin@berlin.de";
export const password = "123456";

const documents = [
	"BaerGPT-Produktinfos.docx",
	"Das-Projektmanagementhandbuch-des-Landes-Berlin.docx",
	"Dummy-Dokument-Excel.xlsx",
	"ikt-rollenkonzept.pdf",
	"Projektmanagementhandbuch_berlin.pdf",
	"test-datei.pdf",
	"Verordnung-ueber-die-Vergabe-oeffentlicher-Auftraege.pdf",
];

// todo: to make the prompts work, you need to create an account and upload the documents from the `files` folder
//  then, you need to fill in the `allowed_document_ids` with the real document ids from your test database
const prompts = [
	{
		content: "Was ist das Rote Rathaus?",
		allowed_document_ids: [],
		chat_id: 2, // todo: Use a chat id that exists in your test database
	},
	{
		content:
			"Was steht über die Gleichstellung von Frauen und Männern in der GGO1 der Berliner Verwaltung?",
		allowed_document_ids: [], // todo: Insert document id GGO1 here
		chat_id: 2, // todo: Use a chat id that exists in your test database
	},
	{
		content: "Was steht in dem Dokument?",
		allowed_document_ids: [], // todo: random document id
		chat_id: 2, // todo: Use a chat id that exists in your test database
	},
	{
		content:
			"Wann kann der öffentliche Auftraggeber Aufträge im Verhandlungsverfahren ohne Teilnahmewettbewerb vergeben?",
		allowed_document_ids: [], // todo: add id Verordnung über die Vergabe öffentlicher Aufträge
		chat_id: 2, // todo: Use a chat id that exists in your test database
	},
	{
		content: "Was ist ein Projekt?",
		allowed_document_ids: [], // todo: Projektmanagement Handbuch
		chat_id: 2, // todo: Use a chat id that exists in your test database
	},
	{
		content:
			"Durch wen erfolgt die Beratung bei der Organisationseinheit IKT-Steuerung?",
		allowed_document_ids: [], // todo: IKT Rollenkonzept
		chat_id: 2, // todo: Use a chat id that exists in your test database
	},
	{
		content: "Was sind die zentralen Anwendungsfälle für den freien Chat?",
		allowed_document_ids: [], // todo: BärGPT Produktinfos
		chat_id: 2, // todo: Use a chat id that exists in your test database
	},
	{
		content: "Welche Arten der Datenverarbeitung gibt es?",
		allowed_document_ids: [], // todo Dummy Dokument Excel
		chat_id: 2, // todo: Use a chat id that exists in your test database
	},
];

export function getPrompt(iteration: number) {
	return prompts[iteration % prompts.length];
}

export function getFileName(iteration: number) {
	return documents[iteration % documents.length];
}

export function getRegistrationEmail(
	virtualUserIndex: number,
	iteration: number,
) {
	// todo: this email should be replaced by a real one to see the received emails
	return `vu-${virtualUserIndex}-${iteration}@example.com`;
}
