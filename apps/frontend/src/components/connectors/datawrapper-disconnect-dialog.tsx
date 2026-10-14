import { useState } from "react";
import Content from "../../content.ts";
import { DefaultDialog } from "../primitives/dialogs/default-dialog.tsx";
import { TertiaryButton } from "../primitives/buttons/tertiary-button.tsx";
import { WarningButton } from "../primitives/buttons/warning-button.tsx";
import { deleteIntegrationKey } from "../../api/integrations/delete-integration-key.ts";
import { useIntegrationsStore } from "../../store/use-integrations-store.ts";

export const datawrapperDisconnectDialogId = "datawrapper-disconnect-dialog";

export function showDatawrapperDisconnectDialog() {
	(
		document.getElementById(datawrapperDisconnectDialogId) as HTMLDialogElement
	)?.showModal();
}

export function hideDatawrapperDisconnectDialog() {
	(
		document.getElementById(datawrapperDisconnectDialogId) as HTMLDialogElement
	)?.close();
}

export const DatawrapperDisconnectDialog = () => {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleCancel = () => {
		hideDatawrapperDisconnectDialog();
	};

	const handleConfirm = async () => {
		setIsSubmitting(true);

		const didDelete = await deleteIntegrationKey("datawrapper");

		setIsSubmitting(false);

		if (didDelete) {
			useIntegrationsStore.getState().removeIntegration("datawrapper");
			hideDatawrapperDisconnectDialog();
		}
	};

	return (
		<DefaultDialog
			id={datawrapperDisconnectDialogId}
			className="w-full md:w-[500px] text-dunkelblau-100 p-5"
		>
			<div className="flex flex-col gap-7">
				<div className="flex flex-col gap-3">
					<div className="flex gap-2 items-center">
						<div className="shrink-0 size-7 rounded-3px bg-white drop-shadow-[0px_0px_2.4px_rgba(36,61,100,0.3)] flex items-center justify-center p-1">
							<img
								src="/icons/datawrapper-icon.svg"
								alt=""
								className="max-w-full max-h-full object-contain"
							/>
						</div>
						<h2 className="text-xl leading-7 font-bold">
							{Content["connectors.datawrapper.disconnect.title"]}
						</h2>
					</div>
					<div className="text-base leading-6 font-normal text-dunkelblau-65 flex flex-col gap-2">
						<p>{Content["connectors.datawrapper.disconnect.body1"]}</p>
						<p>{Content["connectors.datawrapper.disconnect.body2"]}</p>
					</div>
				</div>
				<div className="flex gap-1 items-center justify-end">
					<TertiaryButton type="button" onClick={handleCancel}>
						{Content["connectors.datawrapper.cancelButton"]}
					</TertiaryButton>
					<WarningButton
						type="button"
						disabled={isSubmitting}
						ariaLabel={
							Content["connectors.datawrapper.disconnect.confirmButton"]
						}
						onClick={handleConfirm}
					>
						{Content["connectors.datawrapper.disconnect.confirmButton"]}
					</WarningButton>
				</div>
			</div>
		</DefaultDialog>
	);
};
