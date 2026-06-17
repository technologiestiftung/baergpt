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
import { useDomainStore } from "@/store/use-domain-store";

export const ChangeDomainStatusDialog: React.FC = () => {
	const {
		setSelectedDomain,
		selectedDomain,
		setChangeDomainStatusDialogOpen,
		isChangeDomainStatusDialogOpen,
		activateAllowedEmailDomain,
		deactivateAllowedEmailDomain,
	} = useDomainStore();

	const handleChangeDomainStatus = async () => {
		if (!selectedDomain) {
			return;
		}

		if (selectedDomain.is_active) {
			await deactivateAllowedEmailDomain(selectedDomain.domain);
		} else {
			await activateAllowedEmailDomain(selectedDomain.domain);
		}
		setChangeDomainStatusDialogOpen(false);
		setSelectedDomain(null);
	};

	const handleDialogClose = (open: boolean) => {
		setChangeDomainStatusDialogOpen(open);
		if (!open) {
			setSelectedDomain(null);
		}
	};

	return (
		<Dialog
			open={isChangeDomainStatusDialogOpen}
			onOpenChange={handleDialogClose}
		>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						{selectedDomain?.is_active === true
							? Content["changeDomainStatusDialog.title.deactivate"]
							: Content["changeDomainStatusDialog.title.activate"]}
					</DialogTitle>
					<DialogDescription>
						<div className="my-2">
							{selectedDomain?.is_active && (
								<span>
									{
										Content[
											"changeDomainStatusDialog.description.deactivate.p1"
										]
									}
									{` ${selectedDomain?.user_count} `}
									{
										Content[
											"changeDomainStatusDialog.description.deactivate.p2"
										]
									}
								</span>
							)}
							{!selectedDomain?.is_active && (
								<span
									dangerouslySetInnerHTML={{
										__html:
											Content["changeDomainStatusDialog.description.activate"],
									}}
								/>
							)}
						</div>
						<p className="font-bold text-destructive">
							{selectedDomain?.domain}
						</p>
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleChangeDomainStatus}
						className="hover:text-destructive hover:bg-destructive/10 border-destructive/90 text-destructive"
					>
						{selectedDomain?.is_active === true
							? Content["domainAllowlistTable.tableHeader.actions.deactivate"]
							: Content["domainAllowlistTable.tableHeader.actions.activate"]}
					</Button>
					<Button variant="default" onClick={() => handleDialogClose(false)}>
						{Content["changeDomainStatusDialog.button.cancel"]}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
