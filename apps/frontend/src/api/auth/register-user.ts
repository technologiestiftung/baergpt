export async function registerOrRecoverUser({
	email,
	password,
	firstName,
	lastName,
}: {
	email: string;
	password?: string;
	firstName?: string;
	lastName?: string;
}): Promise<void> {
	const url = `${import.meta.env.VITE_API_URL}/auth/register`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ email, password, firstName, lastName }),
	});

	if (!response.ok) {
		throw new Error("Registration failed");
	}
}
