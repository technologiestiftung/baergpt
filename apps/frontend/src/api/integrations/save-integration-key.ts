import { useAuthStore } from "../../store/auth-store.ts";
import type { IntegrationProvider } from "./get-integrations.ts";

export type SaveIntegrationKeyResult =
	| { status: "success" }
	| { status: "invalid" }
	| { status: "missing_scopes"; requiredScopes: string[] }
	| { status: "error" };

export async function saveIntegrationKey(
	provider: IntegrationProvider,
	key: string,
): Promise<SaveIntegrationKeyResult> {
	const { session } = useAuthStore.getState();
	if (!session?.access_token) {
		return { status: "error" };
	}

	try {
		const response = await fetch(
			`${import.meta.env.VITE_API_URL}/integrations/${provider}/key`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({ key }),
			},
		);

		if (response.status === 204) {
			return { status: "success" };
		}

		if (response.status === 422) {
			const body = await response.json().catch(() => null);
			if (Array.isArray(body?.requiredScopes)) {
				return {
					status: "missing_scopes",
					requiredScopes: body.requiredScopes,
				};
			}
			return { status: "invalid" };
		}

		return { status: "error" };
	} catch {
		return { status: "error" };
	}
}
