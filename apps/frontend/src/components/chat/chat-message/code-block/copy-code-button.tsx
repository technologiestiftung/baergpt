import { useEffect, useRef, useState } from "react";
import { Content } from "../../../../content.ts";
import { ChatButton } from "../../../primitives/buttons/chat-button.tsx";
import { captureError } from "../../../../monitoring/capture-error.ts";
import { useTooltipStore } from "../../../../store/tooltip-store.ts";

const COPIED_DURATION_MS = 2000;

interface CopyCodeButtonProps {
	getCode: () => string;
}

export function CopyCodeButton({ getCode }: CopyCodeButtonProps) {
	const [isCopied, setIsCopied] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const showTooltip = useTooltipStore((state) => state.showTooltip);
	const hideTooltip = useTooltipStore((state) => state.hideTooltip);

	useEffect(() => {
		return () => {
			if (resetTimeoutRef.current) {
				clearTimeout(resetTimeoutRef.current);
				hideTooltip();
			}
		};
	}, []);

	const handleCopy = async () => {
		const code = getCode();
		const target = buttonRef.current;
		if (!code || !target) {
			return;
		}
		try {
			await navigator.clipboard.writeText(code);
			setIsCopied(true);
			showTooltip({
				target,
				content: Content["chat.codeBlockCopyButton.tooltip.copied"],
				anchor: "bottom-end",
			});

			if (resetTimeoutRef.current) {
				clearTimeout(resetTimeoutRef.current);
			}
			resetTimeoutRef.current = setTimeout(() => {
				setIsCopied(false);
				hideTooltip();
			}, COPIED_DURATION_MS);
		} catch (error) {
			captureError(error);
		}
	};

	return (
		<ChatButton
			ref={buttonRef}
			onClick={handleCopy}
			ariaLabel={
				isCopied
					? Content["chat.codeBlockCopyButton.ariaLabel.copied"]
					: Content["chat.codeBlockCopyButton.ariaLabel"]
			}
		>
			<img
				alt=""
				src={
					isCopied
						? "/icons/copy-icon-check.svg"
						: "/icons/copy-icon-outline.svg"
				}
				width={22}
				height={22}
			/>
		</ChatButton>
	);
}
