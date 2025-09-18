import React, { useState } from "react";
import { Content } from "../../../content";
import { ChatButton } from "../../primitives/buttons/chat-button";
import { removeCitationNumbers } from "./export-chat-message/utils";

interface CopyToClipboardButtonProps {
	generatedAnswer: string;
}

export const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({
	generatedAnswer,
}) => {
	const [isCopiedToClipboard, setIsCopiedToClipboard] = useState(false);

	const copyToClipboard = async () => {
		// Remove citation numbers before copying to clipboard
		const cleanText = removeCitationNumbers(generatedAnswer);
		await navigator.clipboard.writeText(cleanText);
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
