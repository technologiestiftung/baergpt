import React, { useEffect, useRef, useState } from "react";
import { Content } from "../../../content";
import { ChatButton } from "../../primitives/buttons/chat-button";
import { generateSpeech } from "../../../api/audio/generate-speech.ts";
import { useErrorStore } from "../../../store/error-store.ts";
import {
	markdownToSpeechText,
	splitSpeechText,
} from "./markdown-to-speech-text.ts";

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

/** Resolves when the audio ends or playback is stopped; rejects on error. */
function waitForEnd(audio: HTMLAudioElement, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const done = () => {
			audio.onended = null;
			audio.onerror = null;
			signal.removeEventListener("abort", done);
		};
		audio.onended = () => {
			done();
			resolve();
		};
		audio.onerror = () => {
			done();
			reject(new Error("Audio playback failed"));
		};
		signal.addEventListener("abort", () => {
			done();
			resolve();
		});
	});
}

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
		const chunks = splitSpeechText(markdownToSpeechText(generatedAnswer));
		if (chunks.length === 0) {
			return;
		}

		stopActivePlayback?.();

		const controller = new AbortController();
		// One element for all chunks keeps the browser's autoplay permission.
		const audio = new Audio();
		const objectUrls = new Set<string>();

		const cleanUp = () => {
			controller.abort();
			audio.pause();
			objectUrls.forEach((url) => URL.revokeObjectURL(url));
			objectUrls.clear();
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

		const fetchChunk = async (text: string) => {
			const blob = await generateSpeech(text, controller.signal);
			const url = URL.createObjectURL(blob);
			objectUrls.add(url);
			return url;
		};

		try {
			let next: Promise<string> | null = fetchChunk(chunks[0]);
			for (let index = 0; index < chunks.length && next; index++) {
				const url: string = await next;
				if (controller.signal.aborted) {
					return;
				}
				// Prefetch the next chunk while this one plays.
				next = index + 1 < chunks.length ? fetchChunk(chunks[index + 1]) : null;
				next?.catch(() => {}); // Handled when awaited.

				audio.src = url;
				await audio.play();
				setStatus("playing");
				await waitForEnd(audio, controller.signal);
				URL.revokeObjectURL(url);
				objectUrls.delete(url);
				if (controller.signal.aborted) {
					return;
				}
			}
			cleanUp();
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
