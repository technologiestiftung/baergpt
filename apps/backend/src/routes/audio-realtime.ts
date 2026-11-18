import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import {
	ByteLengthQueuingStrategy,
	ReadableStream,
	type ReadableStreamDefaultController,
} from "node:stream/web";
import { experimental_streamTranscribe as streamTranscribe } from "ai";
import WebSocket, { WebSocketServer } from "ws";
import { authenticateToken } from "../middleware/basic-auth";
import { getRealtimeTranscriptionModel } from "../services/llm-provider";
import { captureError } from "../monitoring/capture-error";

/**
 * Realtime dictation relay (PoC): browser <-> backend <-> Mistral.
 *
 * The browser cannot hold the Mistral API key, so it streams audio to us and
 * we forward it. Protocol (browser side):
 *   1. text   {"type":"auth","token":"<supabase access token>"}
 *   2. binary PCM s16le, mono, 16 kHz (any chunk size)
 *   3. text   {"type":"stop"}  -> server flushes and sends "done"
 * Server -> browser:
 *   {"type":"ready"} | {"type":"delta","text"} | {"type":"done","text"} | {"type":"error"}
 */

export const REALTIME_PATH = "/audio/realtime";
const SAMPLE_RATE = 16000;
const AUTH_TIMEOUT_MS = 5_000;
const MAX_SESSION_MS = 5 * 60 * 1000;
// Largest accepted WebSocket message. Browser chunks are ~3.2 KB (100 ms PCM);
// the auth message carries a JWT. Keeps unauthenticated clients from sending
// huge frames (ws default is 100 MiB).
const MAX_MESSAGE_BYTES = 64 * 1024;
// Audio waiting to be sent to Mistral. 1 MB = ~32 s of 16 kHz PCM16; if the
// client sends faster than Mistral consumes, we drop the session instead of
// buffering without limit.
const MAX_QUEUED_AUDIO_BYTES = 1024 * 1024;

const CLOSE_NORMAL = 1000;
const CLOSE_TOO_MUCH_DATA = 1009;
const CLOSE_UNAUTHORIZED = 4401;

const send = (socket: WebSocket, message: Record<string, unknown>) => {
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(message));
	}
};

function handleConnection(socket: WebSocket) {
	let authState: "pending" | "authenticating" | "authenticated" = "pending";
	let audioController: ReadableStreamDefaultController<Uint8Array> | null =
		null;
	let isAudioClosed = false;
	const abort = new AbortController();

	const closeAudio = () => {
		if (audioController && !isAudioClosed) {
			isAudioClosed = true;
			try {
				audioController.close();
			} catch {
				// Stream already errored or was cancelled by the consumer.
			}
		}
	};

	const authTimeout = setTimeout(
		() => socket.close(CLOSE_UNAUTHORIZED),
		AUTH_TIMEOUT_MS,
	);
	const sessionTimeout = setTimeout(closeAudio, MAX_SESSION_MS);

	const startTranscription = async () => {
		const audio = new ReadableStream<Uint8Array>(
			{
				start(controller) {
					audioController = controller;
				},
			},
			new ByteLengthQueuingStrategy({ highWaterMark: MAX_QUEUED_AUDIO_BYTES }),
		);

		const result = streamTranscribe({
			model: getRealtimeTranscriptionModel(),
			audio,
			inputAudioFormat: { type: "audio/pcm", rate: SAMPLE_RATE },
			providerOptions: { mistral: { language: "de" } },
			abortSignal: abort.signal,
		});

		send(socket, { type: "ready" });

		try {
			for await (const part of result.fullStream) {
				if (part.type === "transcript-delta") {
					send(socket, { type: "delta", text: part.delta });
				} else if (part.type === "error") {
					throw part.error;
				}
			}
			send(socket, { type: "done", text: await result.text });
		} catch (error) {
			if (!abort.signal.aborted) {
				captureError(error);
				send(socket, { type: "error" });
			}
		} finally {
			socket.close(CLOSE_NORMAL);
		}
	};

	const handleAudio = (chunk: Uint8Array) => {
		if (!audioController || isAudioClosed) {
			return;
		}
		if ((audioController.desiredSize ?? 0) < chunk.byteLength) {
			captureError(new Error("Realtime transcription audio queue full"));
			socket.close(CLOSE_TOO_MUCH_DATA);
			return;
		}
		audioController.enqueue(chunk);
	};

	const handleAuth = async (token: string) => {
		// Set before awaiting so a second "auth" message cannot start a second
		// Mistral session on the same socket.
		authState = "authenticating";
		const session = await authenticateToken(token);
		clearTimeout(authTimeout);
		if (!session) {
			socket.close(CLOSE_UNAUTHORIZED);
			return;
		}
		if (socket.readyState !== WebSocket.OPEN) {
			return; // Client left while we were checking the token.
		}
		authState = "authenticated";
		void startTranscription();
	};

	socket.on("message", (data, isBinary) => {
		if (isBinary) {
			// Default binaryType "nodebuffer" -> data is a Buffer; copy it.
			handleAudio(new Uint8Array(data as Buffer));
			return;
		}

		let message: { type?: string; token?: string };
		try {
			message = JSON.parse(data.toString());
		} catch {
			return;
		}

		if (message.type === "auth" && authState === "pending") {
			void handleAuth(message.token ?? "");
		} else if (message.type === "stop") {
			closeAudio();
		}
	});

	// Without a listener, ws re-throws socket errors (e.g. a frame over
	// maxPayload) and crashes the process. ws closes the socket afterwards.
	socket.on("error", (error) => {
		captureError(error);
	});

	socket.on("close", () => {
		clearTimeout(authTimeout);
		clearTimeout(sessionTimeout);
		abort.abort();
		closeAudio();
	});
}

export function attachRealtimeTranscription(server: Server) {
	const wss = new WebSocketServer({
		noServer: true,
		maxPayload: MAX_MESSAGE_BYTES,
	});
	wss.on("connection", handleConnection);

	server.on(
		"upgrade",
		(request: IncomingMessage, socket: Duplex, head: Buffer) => {
			const { pathname } = new URL(request.url ?? "", "http://localhost");
			if (pathname !== REALTIME_PATH) {
				socket.destroy();
				return;
			}
			wss.handleUpgrade(request, socket, head, (ws) => {
				wss.emit("connection", ws, request);
			});
		},
	);
}
