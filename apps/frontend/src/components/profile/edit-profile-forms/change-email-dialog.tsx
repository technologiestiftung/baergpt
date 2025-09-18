import React from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import Content from "../../../content";
import { useAuthStore } from "../../../store/auth-store";

export const ChangeEmailDialog: React.FC = () => {
	const { session } = useAuthStore();

	const { new_email: requestedNewEmail } = session?.user ?? { new_email: "" };

	return (
		<DefaultDialog id="change-email-dialog" className="w-full md:w-[29rem] p-5">
			<div className="flex flex-col">
				<h3 className="text-lg leading-7 text-dunkelblau-100 font-semibold">
					{Content["profile.changeEmailForm.dialog.title"]} {requestedNewEmail}
				</h3>
				<p className="text-lg leading-7 font-normal text-dunkelblau-100">
					{Content["profile.changeEmailForm.dialog.hint"]}
				</p>

				<button
					className={`
						flex rounded-3px h-9 w-fit items-center px-2.5 gap-2
						self-end text-hellblau-30 bg-dunkelblau-100 hover:bg-dunkelblau-80
						focus-visible:outline-default mt-[25px]`}
					onClick={() => {
						(
							document.getElementById(
								`change-email-dialog`,
							) as HTMLDialogElement
						).close();
					}}
					type="button"
					aria-label={Content["profile.changeEmailForm.dialog.ariaLabel"]}
				>
					{Content["profile.changeEmailForm.dialog.closeButton"]}
				</button>
			</div>
		</DefaultDialog>
	);
};
