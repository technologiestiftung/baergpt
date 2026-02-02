import { useErrorStore } from "../../store/error-store";
import { useAuthStore } from "../../store/auth-store";

export async function deleteDocument(
	documentId: number,
): Promise<Error | null> {
	const { handleError } = useErrorStore.getState();
	const { session } = useAuthStore.getState();
	if (!session?.access_token) {
		const error = new Error("Unauthorized");
		handleError(error);
		return error;
	}

	const response = await fetch(
		`${import.meta.env.VITE_API_URL}/documents/${documentId}`,
		{
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${session.access_token}`,
			},
		},
	);

	if (!response.ok) {
		const errorResponse = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		const error = new Error(errorResponse.error ?? "Document delete failed");
		handleError(error);
		return error;
	}

	return null;
}
