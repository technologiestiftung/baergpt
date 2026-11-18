import React, { type ChangeEvent, useRef, useState } from "react";
import Content from "../../../content.ts";
import { transcribeAudio } from "../../../api/audio/transcribe-audio.ts";

// Must match MAX_AUDIO_BYTES in apps/backend/src/routes/audio.ts.
const MAX_AUDIO_FILE_BYTES = 25 * 1024 * 1024;

interface AudioFileButtonProps {
	isDisabled: boolean;
	onTranscript: (fileName: string, text: string) => void;
	onError: (error: Error) => void;
}

const FileAudioIcon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
		<path d="M14 2v6h6" />
		<path d="M10 17v-5l4-1v5" />
		<circle cx="9" cy="17" r="1" />
		<circle cx="13" cy="16" r="1" />
	</svg>
);

const SpinnerIcon = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		aria-hidden="true"
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

/**
 * PoC: transcribes an uploaded audio file with Voxtral and hands the full
 * text to the chat input (no RAG, unlike document uploads).
 */
export const AudioFileButton: React.FC<AudioFileButtonProps> = ({
	isDisabled,
	onTranscript,
	onError,
}) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isTranscribing, setIsTranscribing] = useState(false);

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) {
			return;
		}
		if (file.size > MAX_AUDIO_FILE_BYTES) {
			onError(new Error(Content["chat.audioFileButton.tooLarge"]));
			return;
		}

		setIsTranscribing(true);
		try {
			const text = (await transcribeAudio(file, file.name)).trim();
			if (text) {
				onTranscript(file.name, text);
			}
		} catch (error) {
			onError(error as Error);
		} finally {
			setIsTranscribing(false);
		}
	};

	const label = isTranscribing
		? Content["chat.dictationButton.transcribing.ariaLabel"]
		: Content["chat.audioFileButton.ariaLabel"];

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="audio/*"
				className="hidden"
				tabIndex={-1}
				aria-hidden="true"
				onChange={handleFileChange}
			/>
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				disabled={isDisabled || isTranscribing}
				aria-label={label}
				aria-busy={isTranscribing}
				title={label}
				className={`rounded-3px h-8 px-1.5 flex items-center gap-1 shrink-0 text-xs font-semibold text-dunkelblau-100 hover:bg-hellblau-50 focus-visible:outline-2px ${
					isTranscribing ? "cursor-wait bg-hellblau-50" : "disabled:opacity-50"
				}`}
			>
				{isTranscribing ? <SpinnerIcon /> : <FileAudioIcon />}
				<span aria-hidden="true">
					{isTranscribing
						? Content["chat.audioFileButton.transcribingText"]
						: Content["chat.audioFileButton.text"]}
				</span>
			</button>
		</>
	);
};
