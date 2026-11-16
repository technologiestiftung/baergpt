import { useRef } from "react";
import { Content } from "../../../../content.ts";
import { ChatButton } from "../../../primitives/buttons/chat-button.tsx";
import { captureError } from "../../../../monitoring/capture-error.ts";
import { useTooltipStore } from "../../../../store/tooltip-store.ts";
import { useToastStore } from "../../../../store/use-toast-store.ts";
import { useCopiedState } from "../../../../hooks/use-copied-state.ts";

const COPIED_DURATION_MS = 2000;

interface CopyCodeButtonProps {
	getCode: () => string;
}

export function CopyCodeButton({ getCode }: CopyCodeButtonProps) {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const shownTooltipTargetRef = useRef<HTMLElement | null>(null);
	const showTooltip = useTooltipStore((state) => state.showTooltip);
	const hideTooltip = useTooltipStore((state) => state.hideTooltip);

	const [isCopied, triggerCopied] = useCopiedState(COPIED_DURATION_MS, () => {
		if (useTooltipStore.getState().target === shownTooltipTargetRef.current) {
			hideTooltip();
		}
	});

	const handleCopy = async () => {
		const code = getCode();
		const target = buttonRef.current;
		if (!target) {
			return;
		}
		try {
			await navigator.clipboard.writeText(code);
			showTooltip({
				target,
				content: Content["chat.codeBlockCopyButton.tooltip.copied"],
				anchor: "bottom-end",
			});
			shownTooltipTargetRef.current = target;
			triggerCopied();
		} catch (error) {
			captureError(error);
			useToastStore
				.getState()
				.addError(Content["chat.codeBlockCopyButton.error"]);
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
