import { useAuthStore } from "../../store/auth-store.ts";
import type { IntegrationProvider } from "./get-integrations.ts";

export async function deleteIntegrationKey(
	provider: IntegrationProvider,
): Promise<boolean> {
	const { session } = useAuthStore.getState();
	if (!session?.access_token) {
		return false;
	}

	try {
		const response = await fetch(
			`${import.meta.env.VITE_API_URL}/integrations/${provider}/key`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${session.access_token}` },
			},
		);

		return response.status === 204;
	} catch {
		return false;
	}
}
