import { captureError } from "../../../../monitoring/capture-error.ts";
import { useErrorStore } from "../../../../store/error-store.ts";

export const exportToDocx = async (markdown: string, fileName: string) => {
	try {
		const { convertMarkdownToDocx, downloadDocx } = await import(
			"@mohtasham/md-to-docx"
		);

		// Remove citation numbers before exporting
		const blob = await convertMarkdownToDocx(markdown);
		downloadDocx(blob, `${fileName}.docx`);
	} catch (error) {
		captureError(error);
		useErrorStore.getState().setUIError("chat-export", "chat_export_failed");
	}
};
