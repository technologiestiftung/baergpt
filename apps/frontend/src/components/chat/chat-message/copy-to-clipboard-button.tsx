import React, { useState } from "react";
import { Content } from "../../../content";
import { ChatButton } from "../../primitives/buttons/chat-button";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

interface CopyToClipboardButtonProps {
	generatedAnswer: string;
}

const markdownToHtml = async (markdown: string): Promise<string> => {
	const file = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype)
		.use(rehypeStringify)
		.process(markdown);
	return String(file);
};

export const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({
	generatedAnswer,
}) => {
	const [isCopiedToClipboard, setIsCopiedToClipboard] = useState(false);

	const copyToClipboard = async () => {
		const html = await markdownToHtml(generatedAnswer);

		// Rich text apps (Word, Google Docs, etc.) use the HTML and preserve formatting
		// Plain text apps (VSC,  etc.) use the plain text version with markdown formatting
		const clipboardItem = new ClipboardItem({
			"text/html": new Blob([html], { type: "text/html" }),
			"text/plain": new Blob([generatedAnswer], { type: "text/plain" }),
		});

		await navigator.clipboard.write([clipboardItem]);
		setIsCopiedToClipboard(true);
		setTimeout(() => {
			setIsCopiedToClipboard(false);
		}, 2000);
	};

	return (
		<ChatButton
			onClick={copyToClipboard}
			aria-label={Content["chat.copyToClipboardButton.ariaLabel"]}
			className="sm:w-[88px]"
		>
			{isCopiedToClipboard ? (
				<>
					<img
						alt="Kopiert"
						src="/icons/copy-icon-check.svg"
						width={20}
						height={20}
					/>
					<span className="hidden sm:flex w-14">
						{Content["chat.copyToClipboardButton.label.copied"]}
					</span>
				</>
			) : (
				<>
					<img
						alt="Kopieren"
						src="/icons/copy-icon.svg"
						width={20}
						height={20}
					/>
					<span className="hidden sm:flex">
						{Content["chat.copyToClipboardButton.label"]}
					</span>
				</>
			)}
		</ChatButton>
	);
};
