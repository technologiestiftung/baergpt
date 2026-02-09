import Content from "../../../content";
import { WarningButton } from "../../primitives/buttons/warning-button";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { showDeleteAccountDialog } from "./delete-account-dialog";

export const DeleteAccount = () => {
	return (
		<>
			<div className="flex flex-col gap-2">
				<h3 className="text-base leading-6 font-semibold">
					{Content["profile.deleteAccount"]}
				</h3>
				<div className="flex flex-col md:flex-row gap-4 justify-between">
					<div className="max-w-[400px]">
						<p className="text-base leading-6 font-normal">
							{Content["profile.deleteAccount.label"]}
						</p>
						<p className="text-sm leading-5 font-normal text-dunkelblau-60">
							{Content["profile.deleteAccount.description"]}
						</p>
					</div>
					<WarningButton
						type="button"
						ariaLabel={Content["profile.deleteAccount.button"]}
						testId="delete-account-button"
						onClick={() => showDeleteAccountDialog()}
					>
						{Content["profile.deleteAccount.button"]}
					</WarningButton>
				</div>
			</div>
			<DeleteAccountDialog />
		</>
	);
};
