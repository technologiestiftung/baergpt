import { type FormEvent, useRef, useState } from "react";
import { DefaultDialog } from "../primitives/dialogs/default-dialog.tsx";
import { saveIntegrationKey } from "../../api/integrations/save-integration-key.ts";
import { useIntegrationsStore } from "../../store/use-integrations-store.ts";
import type { Integration } from "../../api/integrations/get-integrations.ts";
import { ConnectForm } from "./datawrapper-connect-dialog/connect-form.tsx";
import { SuccessView } from "./datawrapper-connect-dialog/success-view.tsx";
import type {
	DialogError,
	DialogMode,
} from "./datawrapper-connect-dialog/types.ts";

export const datawrapperConnectDialogId = "datawrapper-connect-dialog";

export function showDatawrapperConnectDialog() {
	(
		document.getElementById(datawrapperConnectDialogId) as HTMLDialogElement
	)?.showModal();
}

export function hideDatawrapperConnectDialog() {
	(
		document.getElementById(datawrapperConnectDialogId) as HTMLDialogElement
	)?.close();
}

interface DatawrapperConnectDialogProps {
	mode: DialogMode;
	integration?: Integration;
	onSuccess?: () => void;
}

export const DatawrapperConnectDialog = ({
	mode,
	integration,
	onSuccess,
}: DatawrapperConnectDialogProps) => {
	const [token, setToken] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<DialogError | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const formRef = useRef<HTMLFormElement | null>(null);

	const resetState = () => {
		setToken("");
		setIsSubmitting(false);
		setError(null);
		setIsSuccess(false);
		formRef.current?.reset();
	};

	const handleCancel = () => {
		hideDatawrapperConnectDialog();
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!token.trim() || isSubmitting) {
			return;
		}

		setIsSubmitting(true);
		setError(null);

		const result = await saveIntegrationKey("datawrapper", token.trim());

		setIsSubmitting(false);

		if (result.status === "success") {
			await useIntegrationsStore.getState().fetchIntegrations();
			onSuccess?.();
			setIsSuccess(true);
			return;
		}

		if (result.status === "invalid") {
			setError({ type: "invalid" });
			return;
		}

		if (result.status === "missing_scopes") {
			setError({
				type: "missing_scopes",
				requiredScopes: result.requiredScopes,
			});
			return;
		}

		setError({ type: "generic" });
	};

	return (
		<DefaultDialog
			id={datawrapperConnectDialogId}
			className="w-full md:w-[500px] text-dunkelblau-100 p-5"
			afterClose={resetState}
		>
			{isSuccess ? (
				<SuccessView mode={mode} onContinue={handleCancel} />
			) : (
				<ConnectForm
					mode={mode}
					integration={integration}
					token={token}
					onTokenChange={setToken}
					error={error}
					isSubmitting={isSubmitting}
					onCancel={handleCancel}
					onSubmit={handleSubmit}
					formRef={formRef}
				/>
			)}
		</DefaultDialog>
	);
};
