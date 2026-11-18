import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../../../store/auth-store.ts";

// connecting: mic/socket setup until the server is ready (click cancels)
// recording: streaming audio (click stops)
// transcribing: stopped, waiting for the final text
export type DictationStatus =
	"idle" | "connecting" | "recording" | "transcribing";

const TARGET_SAMPLE_RATE = 16000;
const MAX_RECORDING_MS = 5 * 60 * 1000;
// Auto-stop: after speech was detected, stop once it is quiet this long.
const SILENCE_STOP_MS = 2000;
// RMS level that counts as speech (~ -40 dBFS, after browser noise suppression).
const SPEECH_RMS_THRESHOLD = 0.01;

export const isDictationSupported = () =>
	typeof window !== "undefined" &&
	typeof window.AudioWorkletNode !== "undefined" &&
	typeof window.WebSocket !== "undefined" &&
	!!navigator.mediaDevices?.getUserMedia;

/**
 * AudioWorklet: downmix to mono, resample to 16 kHz, convert to PCM s16le and
 * post ~100 ms chunks. Also posts {type:"silence"} once after speech followed
 * by SILENCE_STOP_MS of quiet. Inlined as a Blob so no build config is needed.
 */
const WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.ratio = sampleRate / ${TARGET_SAMPLE_RATE};
		this.position = 0;
		this.buffer = new Int16Array(${TARGET_SAMPLE_RATE / 10});
		this.length = 0;
		this.hasSpeech = false;
		this.silentFrames = 0;
		this.silenceLimit = sampleRate * ${SILENCE_STOP_MS / 1000};
		this.silenceReported = false;
	}
	detectSilence(channel) {
		let sum = 0;
		for (let i = 0; i < channel.length; i++) sum += channel[i] * channel[i];
		const rms = Math.sqrt(sum / channel.length);
		if (rms > ${SPEECH_RMS_THRESHOLD}) {
			this.hasSpeech = true;
			this.silentFrames = 0;
		} else if (this.hasSpeech) {
			this.silentFrames += channel.length;
			if (this.silentFrames >= this.silenceLimit && !this.silenceReported) {
				this.silenceReported = true;
				this.port.postMessage({ type: "silence" });
			}
		}
	}
	process(inputs) {
		const channels = inputs[0];
		if (!channels || channels.length === 0) return true;
		const frames = channels[0].length;
		this.detectSilence(channels[0]);
		for (; this.position < frames; this.position += this.ratio) {
			const index = Math.floor(this.position);
			let sample = 0;
			for (const channel of channels) sample += channel[index];
			sample = Math.max(-1, Math.min(1, sample / channels.length));
			this.buffer[this.length++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			if (this.length === this.buffer.length) {
				this.port.postMessage(this.buffer.buffer.slice(0));
				this.length = 0;
			}
		}
		this.position -= frames;
		return true;
	}
}
registerProcessor("pcm-capture", PcmCaptureProcessor);
`;

const getRealtimeUrl = () =>
	`${import.meta.env.VITE_API_URL.replace(/^http/, "ws")}/audio/realtime`;

type ServerMessage =
	| { type: "ready" }
	| { type: "delta"; text: string }
	| { type: "done"; text: string }
	| { type: "error" };

/** One dictation run. Every callback checks `isActive` so a cancelled or
 * replaced session can never update state again. */
type Session = {
	isActive: boolean;
	isReady: boolean;
	socket: WebSocket | null;
	releaseCapture: () => void;
};

/**
 * Realtime dictation: streams microphone audio to the backend, which relays
 * it to Voxtral Realtime. `onTranscript` receives the full text so far on
 * every update, so the caller can replace its live preview.
 */
export function useRealtimeDictation(
	onTranscript: (text: string, isFinal: boolean) => void,
) {
	const [status, setStatus] = useState<DictationStatus>("idle");
	const [error, setError] = useState<Error | null>(null);
	const sessionRef = useRef<Session | null>(null);
	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;

	/** Ends the session at once: no final text, no further callbacks. */
	const cancel = () => {
		const session = sessionRef.current;
		if (!session) {
			return;
		}
		session.isActive = false;
		session.releaseCapture();
		session.socket?.close(1000);
		sessionRef.current = null;
		setStatus("idle");
	};

	// Unmount (e.g. switching chats): close the socket so the backend ends the
	// billed Mistral session right away.
	const cancelRef = useRef(cancel);
	cancelRef.current = cancel;
	useEffect(() => () => cancelRef.current(), []);

	/** Stops recording; the server then sends the final text and closes. */
	const stop = () => {
		const session = sessionRef.current;
		if (!session) {
			return;
		}
		if (!session.isReady || session.socket?.readyState !== WebSocket.OPEN) {
			// Not streaming yet, so there is nothing to finalize.
			cancel();
			return;
		}
		session.releaseCapture();
		session.socket.send(JSON.stringify({ type: "stop" }));
		setStatus("transcribing");
	};

	const fail = (session: Session, failure: Error) => {
		if (!session.isActive) {
			return;
		}
		setError(failure);
		cancel();
	};

	const start = async () => {
		if (sessionRef.current) {
			return; // Already running (e.g. double-click during the mic prompt).
		}
		const { session: authSession } = useAuthStore.getState();
		if (!authSession?.access_token) {
			setError(new Error("Unauthorized"));
			return;
		}

		const session: Session = {
			isActive: true,
			isReady: false,
			socket: null,
			releaseCapture: () => {},
		};
		sessionRef.current = session;
		setError(null);
		setStatus("connecting");

		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true },
			});
		} catch (micError) {
			fail(session, micError as Error);
			return;
		}

		const audioContext = new AudioContext();
		const workletUrl = URL.createObjectURL(
			new Blob([WORKLET_SOURCE], { type: "application/javascript" }),
		);
		const timeout = window.setTimeout(() => {
			if (session.isActive) {
				stop();
			}
		}, MAX_RECORDING_MS);

		let isCaptureReleased = false;
		session.releaseCapture = () => {
			if (isCaptureReleased) {
				return;
			}
			isCaptureReleased = true;
			window.clearTimeout(timeout);
			stream.getTracks().forEach((track) => track.stop());
			void audioContext.close();
			URL.revokeObjectURL(workletUrl);
		};

		if (!session.isActive) {
			session.releaseCapture(); // Cancelled during the mic prompt.
			return;
		}

		try {
			await audioContext.audioWorklet.addModule(workletUrl);
			await audioContext.resume();
		} catch (workletError) {
			fail(session, workletError as Error);
			return;
		}

		if (!session.isActive) {
			session.releaseCapture();
			return;
		}

		// Create the socket only after all awaits, so no event fires before
		// its handlers below are attached.
		const socket = new WebSocket(getRealtimeUrl());
		socket.binaryType = "arraybuffer";
		session.socket = socket;

		const source = audioContext.createMediaStreamSource(stream);
		const worklet = new AudioWorkletNode(audioContext, "pcm-capture");
		worklet.port.onmessage = (
			event: MessageEvent<ArrayBuffer | { type: "silence" }>,
		) => {
			if (!session.isActive) {
				return;
			}
			if (!(event.data instanceof ArrayBuffer)) {
				stop();
				return;
			}
			// Server drops audio until it is authenticated and connected.
			if (session.isReady && socket.readyState === WebSocket.OPEN) {
				socket.send(event.data);
			}
		};
		source.connect(worklet);

		let transcript = "";

		socket.onopen = () => {
			socket.send(
				JSON.stringify({ type: "auth", token: authSession.access_token }),
			);
		};

		socket.onmessage = (event: MessageEvent<string>) => {
			if (!session.isActive) {
				return;
			}
			const message = JSON.parse(event.data) as ServerMessage;
			if (message.type === "ready") {
				session.isReady = true;
				setStatus("recording");
			} else if (message.type === "delta") {
				transcript += message.text;
				onTranscriptRef.current(transcript.trimStart(), false);
			} else if (message.type === "done") {
				onTranscriptRef.current(message.text.trim(), true);
			} else if (message.type === "error") {
				fail(session, new Error("Realtime transcription failed"));
			}
		};

		// A failed connection fires "error" and then "close"; report it once,
		// from "close", which also carries the reason code.
		socket.onclose = (event) => {
			if (!session.isActive) {
				return;
			}
			if (event.code !== 1000) {
				fail(session, new Error(`Realtime connection closed (${event.code})`));
				return;
			}
			session.isActive = false;
			session.releaseCapture();
			sessionRef.current = null;
			setStatus("idle");
		};
	};

	const toggle = () => {
		if (status === "idle") {
			void start();
		} else if (status === "connecting" || status === "recording") {
			stop();
		}
	};

	return { status, error, toggle, cancel };
}
