import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useAuthStore } from "../../../store/auth-store.ts";

/**
 * Temporary form to test storing a Datawrapper API key locally.
 * TODO: replace with the final design (and move texts to content.ts).
 */

type Integration = {
	provider: string;
	last4: string;
	scopes: string[];
	updated_at: string;
};

const integrationsUrl = `${import.meta.env.VITE_API_URL}/integrations`;

export const DatawrapperKeyForm = () => {
	const { session } = useAuthStore();
	const [key, setKey] = useState("");
	const [integration, setIntegration] = useState<Integration | null>(null);
	const [message, setMessage] = useState("");

	const request = useCallback(
		(path: string, init: { method?: string; body?: string } = {}) =>
			fetch(`${integrationsUrl}${path}`, {
				...init,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session?.access_token}`,
				},
			}),
		[session?.access_token],
	);

	const loadIntegration = useCallback(async () => {
		const response = await request("");
		const integrations: Integration[] = response.ok
			? await response.json()
			: [];
		setIntegration(
			integrations.find(({ provider }) => provider === "datawrapper") ?? null,
		);
	}, [request]);

	useEffect(() => {
		loadIntegration();
	}, [loadIntegration]);

	const handleSave = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const response = await request("/datawrapper/key", {
			method: "PUT",
			body: JSON.stringify({ key }),
		});

		if (response.ok) {
			setKey("");
			setMessage("Gespeichert.");
		} else {
			const { error, requiredScopes } = await response.json();
			setMessage(
				requiredScopes ? `${error}: ${requiredScopes.join(", ")}` : error,
			);
		}
		await loadIntegration();
	};

	const handleDelete = async () => {
		const response = await request("/datawrapper/key", { method: "DELETE" });
		setMessage(response.ok ? "Gelöscht." : "Löschen fehlgeschlagen.");
		await loadIntegration();
	};

	return (
		<form onSubmit={handleSave} className="flex flex-col gap-y-3">
			<h3 className="text-base leading-6 font-semibold">
				Datawrapper-API-Token (Test)
			</h3>
			<p className="text-sm">
				{integration
					? `Gespeichert: ••••${integration.last4} (${integration.scopes.join(", ")})`
					: "Kein Token gespeichert."}
			</p>
			<input
				type="password"
				autoComplete="off"
				aria-label="Datawrapper-API-Token"
				value={key}
				onChange={(event) => setKey(event.target.value)}
				className="border border-black rounded-3px px-3 py-2 text-sm"
			/>
			<div className="flex gap-3">
				<button
					type="submit"
					disabled={!key}
					className="border border-black rounded-3px px-3 py-1 text-sm disabled:opacity-50"
				>
					Speichern
				</button>
				<button
					type="button"
					onClick={handleDelete}
					disabled={!integration}
					className="border border-black rounded-3px px-3 py-1 text-sm disabled:opacity-50"
				>
					Löschen
				</button>
			</div>
			{message && <p className="text-sm">{message}</p>}
		</form>
	);
};
