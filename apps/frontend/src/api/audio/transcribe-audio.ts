import { useAuthStore } from "../../store/auth-store";

export async function transcribeAudio(
	audio: Blob,
	fileName: string,
): Promise<string> {
	const { session } = useAuthStore.getState();
	if (!session?.access_token) {
		throw new Error("Unauthorized");
	}

	const formData = new FormData();
	formData.append("audio", audio, fileName);

	const response = await fetch(
		`${import.meta.env.VITE_API_URL}/audio/transcriptions`,
		{
			method: "POST",
			headers: { Authorization: `Bearer ${session.access_token}` },
			body: formData,
		},
	);

	if (!response.ok) {
		const errorResponse = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		throw new Error(errorResponse.error ?? "Transcription failed");
	}

	const { text } = (await response.json()) as { text: string };
	return text;
}
