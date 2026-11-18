import React from "react";
import Content from "../../../content.ts";
import type { DictationStatus } from "./hooks/use-realtime-dictation.ts";

interface DictationButtonProps {
	status: DictationStatus;
	onClick: () => void;
	isDisabled: boolean;
}

const iconProps = {
	width: 20,
	height: 20,
	viewBox: "0 0 24 24",
	"aria-hidden": true,
} as const;

const MicIcon = () => (
	<svg
		{...iconProps}
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<rect x="9" y="2" width="6" height="12" rx="3" />
		<path d="M5 10a7 7 0 0 0 14 0" />
		<path d="M12 17v4" />
	</svg>
);

const StopIcon = () => (
	<svg {...iconProps} fill="currentColor">
		<rect x="6" y="6" width="12" height="12" rx="1.5" />
	</svg>
);

const labels: Record<DictationStatus, string> = {
	idle: Content["chat.dictationButton.start.ariaLabel"],
	connecting: Content["chat.dictationButton.cancel.ariaLabel"],
	recording: Content["chat.dictationButton.stop.ariaLabel"],
	transcribing: Content["chat.dictationButton.transcribing.ariaLabel"],
};

export const DictationButton: React.FC<DictationButtonProps> = ({
	status,
	onClick,
	isDisabled,
}) => {
	const isRecording = status === "recording" || status === "connecting";
	const isTranscribing = status === "transcribing";
	// Only block starting a new recording; a running one must stay stoppable.
	const isButtonDisabled = (isDisabled && status === "idle") || isTranscribing;
	const label = labels[status];

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isButtonDisabled}
			aria-label={label}
			aria-pressed={isRecording}
			title={label}
			className={`rounded-3px h-8 px-1.5 flex items-center gap-1 shrink-0 text-xs font-semibold focus-visible:outline-2px disabled:opacity-50 ${
				isRecording
					? "bg-hellblau-50 text-dunkelblau-100 animate-pulse motion-reduce:animate-none"
					: "text-dunkelblau-100 hover:bg-hellblau-50"
			} ${isTranscribing ? "cursor-wait" : ""}`}
		>
			{isRecording ? <StopIcon /> : <MicIcon />}
			<span aria-hidden="true">{Content["chat.dictationButton.text"]}</span>
		</button>
	);
};
