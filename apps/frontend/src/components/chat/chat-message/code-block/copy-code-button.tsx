import { useState } from "react";
import { Content } from "../../../../content.ts";
import { ChatButton } from "../../../primitives/buttons/chat-button.tsx";
import { captureError } from "../../../../monitoring/capture-error.ts";

interface CopyCodeButtonProps {
	getCode: () => string;
}

export function CopyCodeButton({ getCode }: CopyCodeButtonProps) {
	const [isCopied, setIsCopied] = useState(false);

	const handleCopy = async () => {
		const code = getCode();
		if (!code) {
			return;
		}
		try {
			await navigator.clipboard.writeText(code);
			setIsCopied(true);
			setTimeout(() => {
				setIsCopied(false);
			}, 2000);
		} catch (error) {
			captureError(error);
		}
	};

	return (
		<ChatButton
			onClick={handleCopy}
			ariaLabel={
				isCopied
					? Content["chat.codeBlockCopyButton.ariaLabel.copied"]
					: Content["chat.codeBlockCopyButton.ariaLabel"]
			}
		>
			<img
				alt=""
				src={isCopied ? "/icons/copy-icon-check.svg" : "/icons/copy-icon.svg"}
				width={20}
				height={20}
			/>
		</ChatButton>
	);
}
