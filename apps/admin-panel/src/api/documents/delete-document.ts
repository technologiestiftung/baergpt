import { useAuthStore } from "../../store/use-auth-store";

export async function deleteDocument(documentId: number): Promise<void> {
	try {
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
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to delete document");
		}
	} catch (error) {
		console.error("Error deleting document:", error);
		throw error;
	}
}
