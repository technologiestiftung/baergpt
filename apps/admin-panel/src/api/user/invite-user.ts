import { useAuthStore } from "../../store/use-auth-store";

export async function inviteUser(
	email: string,
	firstName?: string,
	lastName?: string,
): Promise<void> {
	const response = await fetch(
		`${import.meta.env.VITE_API_URL}/admin/users/invite`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${useAuthStore.getState().session?.access_token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email,
				firstName,
				lastName,
			}),
		},
	);
	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.error || "Failed to invite user");
	}
}
