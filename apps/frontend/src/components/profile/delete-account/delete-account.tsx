import Content from "../../../content";
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
					<button
						id="delete-account-button"
						className="p-2 rounded-[3px] w-fit flex-shrink-0 self-end md:self-center text-white text-sm leading-5 font-normal bg-warning-100 hover:bg-warning-85 focus-visible:outline-default"
						onClick={() => showDeleteAccountDialog()}
						aria-label={Content["profile.deleteAccount.button"]}
					>
						{Content["profile.deleteAccount.button"]}
					</button>
				</div>
			</div>
			<DeleteAccountDialog />
		</>
	);
};
