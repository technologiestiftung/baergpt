import { captureError } from "../../../../monitoring/capture-error.ts";

export const removeCitationNumbers = (text: string): string => {
	return text.replace(/\[\d+\]/g, "");
};

export const exportToDocx = async (markdown: string, fileName: string) => {
	try {
		const { convertMarkdownToDocx, downloadDocx } = await import(
			"@mohtasham/md-to-docx"
		);

		// Remove citation numbers before exporting
		const cleanMarkdown = removeCitationNumbers(markdown);
		const blob = await convertMarkdownToDocx(cleanMarkdown);
		downloadDocx(blob, `${fileName}.docx`);
	} catch (error) {
		captureError(error);
	}
};
