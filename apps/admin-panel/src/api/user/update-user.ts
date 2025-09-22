import { useAuthStore } from "../../store/use-auth-store.ts";

type UpdateUserProfileParams = {
	firstName?: string;
	lastName?: string;
	academicTitle?: string;
	email?: string;
	personalTitle?: string;
};

export async function updateUserProfile(
	userId: string,
	params: UpdateUserProfileParams,
): Promise<{ message?: string; [key: string]: unknown }> {
	const { firstName, lastName, academicTitle, email, personalTitle } = params;

	try {
		const response = await fetch(
			`${import.meta.env.VITE_API_URL}/admin/users/${userId}/profile`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${useAuthStore.getState().session?.access_token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					firstName,
					lastName,
					academic_title: academicTitle,
					email,
					personal_title: personalTitle,
				}),
			},
		);

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to update user profile");
		}

		const result = await response.json();
		return result;
	} catch (err) {
		console.error("Error updating user profile:", err);
		throw err;
	}
}

export async function updateUserAdminStatus(
	userId: string,
	isAdmin: boolean,
): Promise<{ message?: string; [key: string]: unknown }> {
	try {
		const response = await fetch(
			`${import.meta.env.VITE_API_URL}/admin/users/${userId}/admin`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${useAuthStore.getState().session?.access_token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ isAdmin }),
			},
		);

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to update admin status");
		}

		const result = await response.json();
		return result;
	} catch (err) {
		console.error("Error updating admin status:", err);
		throw err;
	}
}
