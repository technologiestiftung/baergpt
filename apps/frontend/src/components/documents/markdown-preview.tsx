import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Content from "../../content.ts";
import { useErrorStore } from "../../store/error-store.ts";
import { MarkdownWrapperScrollableTable } from "../primitives/markdown/markdown-wrapper-scrollable-table.tsx";
import { AnchorLinkTargetBlank } from "../primitives/markdown/anchor-link-target-blank.tsx";

// Never add rehype-raw: raw HTML in uploaded files has to stay plain text
const markdownComponents = {
	table: MarkdownWrapperScrollableTable,
	a: AnchorLinkTargetBlank,
	img: () => null,
};

export function MarkdownPreview({ downloadUrl }: { downloadUrl: string }) {
	const [markdown, setMarkdown] = useState("");
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		setIsLoading(true);
		const abortController = new AbortController();

		(async () => {
			try {
				const response = await fetch(downloadUrl, {
					signal: abortController.signal,
				});
				const text = await response.text();

				if (abortController.signal.aborted) {
					return;
				}

				setMarkdown(text);
			} catch (error) {
				if (!abortController.signal.aborted) {
					useErrorStore.getState().handleError(error as Error);
				}
			} finally {
				if (!abortController.signal.aborted) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			abortController.abort();
			setMarkdown("");
			setIsLoading(false);
		};
	}, [downloadUrl]);

	if (isLoading) {
		return (
			<p className="text-lg text-dunkelblau-80 pt-4">
				{Content["documentsPreviewSection.loadingPreview"]}
			</p>
		);
	}

	return (
		<div
			className="w-full h-full overflow-y-auto bg-white shadow-md px-6 py-5 md:px-10 md:py-8 text-dunkelblau-100"
			data-testid="markdown-preview"
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				className="markdown-container"
				components={markdownComponents}
			>
				{markdown}
			</ReactMarkdown>
		</div>
	);
}
