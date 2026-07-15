import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Content from "@/content";
import { useIndividualEmailStore } from "@/store/use-individual-email-store";

export const RemoveIndividualEmailDialog: React.FC = () => {
	const {
		setSelectedEmail,
		selectedEmail,
		setRemoveEmailDialogOpen,
		isRemoveEmailDialogOpen,
		removeAllowedIndividualEmail,
	} = useIndividualEmailStore();

	const handleRemove = async () => {
		if (!selectedEmail) {
			return;
		}
		await removeAllowedIndividualEmail(selectedEmail.email);
		setRemoveEmailDialogOpen(false);
		setSelectedEmail(null);
	};

	const handleDialogClose = (open: boolean) => {
		setRemoveEmailDialogOpen(open);
		if (!open) {
			setSelectedEmail(null);
		}
	};

	return (
		<Dialog open={isRemoveEmailDialogOpen} onOpenChange={handleDialogClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						{Content["removeIndividualEmailDialog.title"]}
					</DialogTitle>
					<DialogDescription asChild>
						<div className="my-2">
							<p>
								{selectedEmail?.has_account
									? Content[
											"removeIndividualEmailDialog.description.withAccount"
										]
									: Content[
											"removeIndividualEmailDialog.description.noAccount"
										]}
								<span className="font-bold">{` "${selectedEmail?.email}" `}</span>
								{Content["removeIndividualEmailDialog.description.p2"]}
							</p>
						</div>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleRemove}
						className="hover:text-destructive hover:bg-destructive/10 border-destructive/90 text-destructive"
					>
						{
							Content[
								"individualEmailAllowlistTable.tableHeader.actions.remove"
							]
						}
					</Button>
					<Button variant="default" onClick={() => handleDialogClose(false)}>
						{Content["removeIndividualEmailDialog.button.cancel"]}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
