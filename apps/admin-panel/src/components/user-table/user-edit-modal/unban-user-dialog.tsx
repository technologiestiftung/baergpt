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

export const UnbanUserDialog: React.FC = () => {
	const {
		selectedUser,
		isRestoreUserDialogOpen,
		setSelectedUser,
		setRestoreUserDialogOpen,
		unbanUser,
		getUsers,
	} = useUserStore();

	const handleRestoreUser = async () => {
		if (!selectedUser) {
			return;
		}

		await unbanUser(selectedUser.user_id);

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
						{Content["userEditModal.unbanUserDialog.title"]}
					</DialogTitle>
					<DialogDescription>
						{selectedUser && (
							<>
								{Content["userEditModal.unbanUserDialog.description.p1"]}{" "}
								{selectedUser.first_name} {selectedUser.last_name} (
								{selectedUser.email}){" "}
								{Content["userEditModal.unbanUserDialog.description.p2"]}
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleDialogClose(false)}>
						{Content["userEditModal.unbanUserDialog.button.cancel"]}
					</Button>
					<Button onClick={handleRestoreUser}>
						{Content["userEditModal.unbanUserDialog.button.restore"]}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
