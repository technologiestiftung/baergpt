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
		isUnbanUserDialogOpen,
		setSelectedUser,
		setUnbanUserDialogOpen,
		unbanUser,
		getUsers,
	} = useUserStore();

	const handleUnbanUser = async () => {
		if (!selectedUser) {
			return;
		}

		await unbanUser(selectedUser.user_id);

		setUnbanUserDialogOpen(false);
		setSelectedUser(null);
		await getUsers(new AbortController().signal); // Refresh user list after deletion
	};

	const handleDialogClose = (open: boolean) => {
		setUnbanUserDialogOpen(open);
	};

	return (
		<Dialog open={isUnbanUserDialogOpen} onOpenChange={handleDialogClose}>
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
					<Button onClick={handleUnbanUser}>
						{Content["userEditModal.unbanUserDialog.button.unban"]}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
