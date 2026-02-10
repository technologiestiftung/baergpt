import { useAuthStore } from "../../store/use-auth-store";

export async function deleteDocument(documentId: number): Promise<void> {
	const { session } = useAuthStore.getState();
	if (!session?.access_token) {
		const error = new Error("Unauthorized");
		throw error;
	}
	const response = await fetch(
		`${import.meta.env.VITE_API_URL}/documents/${documentId}`,
		{
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${useAuthStore.getState().session?.access_token}`,
			},
		},
	);

	if (!response.ok) {
		const errorResponse = await response
			.json()
			.catch(() => ({ error: "Unknown error" }));
		const error = new Error(errorResponse.error ?? "Document delete failed");
		throw error;
	}
}
