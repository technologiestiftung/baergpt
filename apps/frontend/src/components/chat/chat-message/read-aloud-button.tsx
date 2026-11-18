import React, { useEffect, useRef, useState } from "react";
import { Content } from "../../../content";
import { ChatButton } from "../../primitives/buttons/chat-button";
import { generateSpeech } from "../../../api/audio/generate-speech.ts";
import { useErrorStore } from "../../../store/error-store.ts";
import { markdownToSpeechText } from "./markdown-to-speech-text.ts";

type ReadAloudStatus = "idle" | "loading" | "playing";

interface ReadAloudButtonProps {
	generatedAnswer: string;
}

// Only one message may be read at a time: starting another stops this one.
let stopActivePlayback: (() => void) | null = null;

const iconProps = {
	width: 20,
	height: 20,
	viewBox: "0 0 24 24",
	"aria-hidden": true,
} as const;

const SpeakerIcon = () => (
	<svg
		{...iconProps}
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M11 5 6 9H3v6h3l5 4z" />
		<path d="M15.5 8.5a5 5 0 0 1 0 7" />
		<path d="M18.5 5.5a9 9 0 0 1 0 13" />
	</svg>
);

const StopIcon = () => (
	<svg {...iconProps} fill="currentColor">
		<rect x="6" y="6" width="12" height="12" rx="1.5" />
	</svg>
);

const SpinnerIcon = () => (
	<svg
		{...iconProps}
		fill="none"
		className="animate-spin motion-reduce:animate-[spin_1.5s_linear_infinite]"
	>
		<circle
			cx="12"
			cy="12"
			r="9"
			stroke="currentColor"
			strokeWidth="2.5"
			opacity="0.25"
		/>
		<path
			d="M21 12a9 9 0 0 0-9-9"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
		/>
	</svg>
);

const labels: Record<ReadAloudStatus, string> = {
	idle: Content["chat.readAloudButton.label"],
	loading: Content["chat.readAloudButton.label.loading"],
	playing: Content["chat.readAloudButton.label.stop"],
};

const ariaLabels: Record<ReadAloudStatus, string> = {
	idle: Content["chat.readAloudButton.ariaLabel"],
	loading: Content["chat.readAloudButton.ariaLabel.loading"],
	playing: Content["chat.readAloudButton.ariaLabel.stop"],
};

/** PoC: reads an answer aloud with Voxtral TTS. Click again to stop. */
export const ReadAloudButton: React.FC<ReadAloudButtonProps> = ({
	generatedAnswer,
}) => {
	const [status, setStatus] = useState<ReadAloudStatus>("idle");
	const stopRef = useRef<(() => void) | null>(null);

	// Stop playback and cancel a pending request when the message unmounts.
	useEffect(() => () => stopRef.current?.(), []);

	const stop = () => stopRef.current?.();

	const play = async () => {
		const text = markdownToSpeechText(generatedAnswer);
		if (!text) {
			return;
		}

		stopActivePlayback?.();

		const controller = new AbortController();
		let audio: HTMLAudioElement | null = null;
		let objectUrl: string | null = null;

		const cleanUp = () => {
			controller.abort();
			audio?.pause();
			if (objectUrl) {
				URL.revokeObjectURL(objectUrl);
			}
			if (stopActivePlayback === cleanUp) {
				stopActivePlayback = null;
			}
			if (stopRef.current === cleanUp) {
				stopRef.current = null;
				setStatus("idle");
			}
		};

		stopRef.current = cleanUp;
		stopActivePlayback = cleanUp;
		setStatus("loading");

		try {
			const blob = await generateSpeech(text, controller.signal);
			if (controller.signal.aborted) {
				return;
			}
			objectUrl = URL.createObjectURL(blob);
			audio = new Audio(objectUrl);
			audio.onended = cleanUp;
			audio.onerror = cleanUp;
			await audio.play();
			setStatus("playing");
		} catch (error) {
			if (!controller.signal.aborted) {
				useErrorStore.getState().handleError(error);
			}
			cleanUp();
		}
	};

	const isActive = status !== "idle";

	return (
		<ChatButton
			onClick={isActive ? stop : play}
			ariaLabel={ariaLabels[status]}
			title={ariaLabels[status]}
			className="sm:min-w-[88px]"
		>
			{status === "idle" && <SpeakerIcon />}
			{status === "loading" && <SpinnerIcon />}
			{status === "playing" && <StopIcon />}
			<span className="hidden sm:flex" aria-hidden="true">
				{labels[status]}
			</span>
		</ChatButton>
	);
};
