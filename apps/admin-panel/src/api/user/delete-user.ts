import { useAuthStore } from "../../store/use-auth-store.ts";

export async function deleteUser(
	userId: string,
	hardDelete = false,
): Promise<{ message?: string; [key: string]: unknown }> {
	try {
		const url = hardDelete
			? `${import.meta.env.VITE_API_URL}/admin/users/${userId}?hard=true`
			: `${import.meta.env.VITE_API_URL}/admin/users/${userId}`;

		const response = await fetch(url, {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${useAuthStore.getState().session?.access_token}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to delete user");
		}

		const result = await response.json();
		return result;
	} catch (err) {
		console.error("Error deleting user:", err);
		throw err;
	}
}
