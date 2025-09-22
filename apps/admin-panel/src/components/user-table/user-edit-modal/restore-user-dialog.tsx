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
import { useUserStore } from "@/store/use-user-store";
import Content from "../../../content";

export const RestoreUserDialog: React.FC = () => {
	const {
		selectedUser,
		isRestoreUserDialogOpen,
		setSelectedUser,
		setRestoreUserDialogOpen,
		restoreUser,
		getUsers,
	} = useUserStore();

	const handleRestoreUser = async () => {
		if (!selectedUser) {
			return;
		}

		await restoreUser(selectedUser.user_id);

		setRestoreUserDialogOpen(false);
		setSelectedUser(null);
		await getUsers(new AbortController().signal); // Refresh user list after deletion
	};

	const handleDialogClose = (open: boolean) => {
		setRestoreUserDialogOpen(open);
	};

	return (
		<Dialog open={isRestoreUserDialogOpen} onOpenChange={handleDialogClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						{Content["userEditModal.restoreUserDialog.title"]}
					</DialogTitle>
					<DialogDescription>
						{selectedUser && (
							<>
								{Content["userEditModal.restoreUserDialog.description.p1"]}{" "}
								{selectedUser.first_name} {selectedUser.last_name} (
								{selectedUser.email}){" "}
								{Content["userEditModal.restoreUserDialog.description.p2"]}
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleDialogClose(false)}>
						{Content["userEditModal.restoreUserDialog.button.cancel"]}
					</Button>
					<Button onClick={handleRestoreUser}>
						{Content["userEditModal.restoreUserDialog.button.restore"]}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
