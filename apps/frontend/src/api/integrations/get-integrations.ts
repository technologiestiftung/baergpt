import { useAuthStore } from "../../store/auth-store.ts";
import { useErrorStore } from "../../store/error-store.ts";

export type IntegrationProvider = "datawrapper";

export type Integration = {
	provider: IntegrationProvider;
	last4: string;
	scopes: string[];
	updated_at: string;
};

export async function getIntegrations(): Promise<Integration[] | null> {
	const { session } = useAuthStore.getState();
	if (!session?.access_token) {
		return null;
	}

	try {
		const response = await fetch(
			`${import.meta.env.VITE_API_URL}/integrations`,
			{
				headers: { Authorization: `Bearer ${session.access_token}` },
			},
		);

		if (!response.ok) {
			useErrorStore
				.getState()
				.handleError(new Error("Failed to load integrations"));
			return null;
		}

		return await response.json();
	} catch (error) {
		useErrorStore.getState().handleError(error);
		return null;
	}
}
