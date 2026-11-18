import { Hono } from "hono";
import type { Context } from "hono";
import { transcribe } from "ai";
import { getTranscriptionModel } from "../services/llm-provider";
import { captureError } from "../monitoring/capture-error";

// PoC limit for dictation and uploaded audio files. Mistral's own maximum
// file size/duration is not verified yet.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

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

export default audio;
