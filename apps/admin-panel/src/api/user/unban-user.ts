import { useAuthStore } from "../../store/use-auth-store.ts";

export async function unbanUser(
	userId: string,
): Promise<{ message?: string; [key: string]: unknown }> {
	const url = `${import.meta.env.VITE_API_URL}/admin/users/${userId}/unban`;

	const response = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${useAuthStore.getState().session?.access_token}`,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.error || "Failed to unban user");
	}

	const result = await response.json();
	return result;
}
