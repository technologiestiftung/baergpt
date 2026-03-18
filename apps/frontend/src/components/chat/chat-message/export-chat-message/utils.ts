import { captureError } from "../../../../monitoring/capture-error.ts";
import { useErrorStore } from "../../../../store/error-store.ts";

export const exportToDocx = async (markdown: string, fileName: string) => {
	try {
		const { convertMarkdownToDocx, downloadDocx } = await import(
			"@mohtasham/md-to-docx"
		);

		const exportOptions = {
			documentType: "document" as const,
			style: {
				titleSize: 32,
				headingSpacing: 240,
				paragraphSpacing: 240,
				lineSpacing: 1.15,
				fontFamily: "Berlin Type",
			},
		};

		const blob = await convertMarkdownToDocx(markdown, exportOptions);
		downloadDocx(blob, `${fileName}.docx`);
	} catch (error) {
		captureError(error);
		useErrorStore.getState().setUIError("chat-export", "chat_export_failed");
	}
};
