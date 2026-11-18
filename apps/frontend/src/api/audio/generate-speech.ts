import { useAuthStore } from "../../store/auth-store";

/** Voxtral TTS via the backend. Returns an mp3 blob. */
export async function generateSpeech(
	text: string,
	signal?: AbortSignal,
): Promise<Blob> {
	const { session } = useAuthStore.getState();
	if (!session?.access_token) {
		throw new Error("Unauthorized");
	}

	const response = await fetch(`${import.meta.env.VITE_API_URL}/audio/speech`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${session.access_token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ text }),
		signal,
	});

	if (!response.ok) {
		const errorResponse = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		throw new Error(errorResponse.error ?? "Speech generation failed");
	}

	return response.blob();
}
