import { useAuthStore } from "../../store/use-auth-store";

export async function deleteDocument(documentId: number): Promise<void> {
	const { session } = useAuthStore.getState();

	const headers = new Headers();
	headers.set("Content-Type", "application/json");
	headers.set("Authorization", `Bearer ${session?.access_token}`);

	const response: Response = await fetch(
		`${import.meta.env.VITE_API_URL}/documents/${documentId}`,
		{
			method: "DELETE",
			headers,
		},
	);

	if (!response.ok) {
		const error = await response.json();
		console.error("Error deleting document:", error);
		throw new Error(error.message);
	}
}
