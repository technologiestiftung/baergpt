import { Hono } from "hono";
import type { Context } from "hono";
import { generateSpeech, transcribe } from "ai";
import {
	getSpeechModel,
	getTranscriptionModel,
	SPEECH_VOICE,
} from "../services/llm-provider";
import { captureError } from "../monitoring/capture-error";

// PoC limit for dictation and uploaded audio files. Mistral's own maximum
// file size/duration is not verified yet.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
// PoC limit for read-aloud. Mistral's own TTS input limit is not verified yet.
const MAX_SPEECH_CHARS = 10_000;

const audio = new Hono();

audio.post("/transcriptions", async (c: Context) => {
	const body = await c.req.parseBody();
	const file = body["audio"];

	if (!(file instanceof File)) {
		return c.json({ error: "Invalid request: audio file is required" }, 400);
	}
	if (!file.type.startsWith("audio/")) {
		return c.json({ error: "Invalid request: unsupported media type" }, 415);
	}
	if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
		return c.json({ error: "Invalid request: audio file size" }, 413);
	}

	try {
		const result = await transcribe({
			model: getTranscriptionModel(),
			audio: new Uint8Array(await file.arrayBuffer()),
			providerOptions: { mistral: { language: "de" } },
		});

		return c.json({
			text: result.text,
			durationInSeconds: result.durationInSeconds,
		});
	} catch (error) {
		captureError(error);
		return c.json({ error: "Transcription failed" }, 502);
	}
});

audio.post("/speech", async (c: Context) => {
	const body = (await c.req.json().catch(() => null)) as {
		text?: unknown;
	} | null;
	const text = typeof body?.text === "string" ? body.text.trim() : "";

	if (!text) {
		return c.json({ error: "Invalid request: text is required" }, 400);
	}
	if (text.length > MAX_SPEECH_CHARS) {
		return c.json({ error: "Invalid request: text is too long" }, 413);
	}

	try {
		const { audio: speech } = await generateSpeech({
			model: getSpeechModel(),
			text,
			voice: SPEECH_VOICE,
			outputFormat: "mp3",
			abortSignal: c.req.raw.signal,
		});

		return c.body(speech.uint8Array as Uint8Array<ArrayBuffer>, 200, {
			"Content-Type": speech.mediaType || "audio/mpeg",
			"Cache-Control": "no-store",
		});
	} catch (error) {
		if (c.req.raw.signal.aborted) {
			// Client stopped the request; nobody reads this response.
			return new Response(null, { status: 499 });
		}
		captureError(error);
		return c.json({ error: "Speech generation failed" }, 502);
	}
});

export default audio;
