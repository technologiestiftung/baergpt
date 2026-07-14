import React, { useState } from "react";
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
import { banUser } from "@/api/user/ban-user.ts";

export const BanOrDeleteUserDialog: React.FC = () => {
	const {
		selectedUser,
		isDeleteUserDialogOpen,
		setSelectedUser,
		setDeleteUserDialogOpen,
		deleteUser,
		getUsers,
	} = useUserStore();

	const [type, setType] = useState<"ban" | "delete">("ban");

	const handleDeleteUser = async () => {
		if (!selectedUser) {
			return;
		}

		if (type === "ban") {
			await banUser(selectedUser.user_id);
		}

		if (type === "delete") {
			await deleteUser(selectedUser.user_id);
		}

		setDeleteUserDialogOpen(false);
		setSelectedUser(null);
		setType("ban"); // Reset to default

		await getUsers(new AbortController().signal); // Refresh user list after deletion
	};

	const handleDialogClose = (open: boolean) => {
		setDeleteUserDialogOpen(open);
		if (!open) {
			setType("ban"); // Reset to default when closing
		}
	};

	return (
		<Dialog open={isDeleteUserDialogOpen} onOpenChange={handleDialogClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						{Content["userEditModal.deleteUserDialog.title"]}
					</DialogTitle>
					<DialogDescription>
						{selectedUser && (
							<>
								{Content["userEditModal.deleteUserDialog.description.p1"]}{" "}
								{selectedUser.first_name} {selectedUser.last_name} (
								{selectedUser.email}){" "}
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-3">
						<div className="flex items-start space-x-3">
							<input
								type="radio"
								id="ban"
								name="type"
								value="ban"
								checked={type === "ban"}
								onChange={(e) => setType(e.currentTarget.value as typeof type)}
								className="mt-1"
							/>
							<div className="flex-1">
								<label
									htmlFor="ban"
									className="font-medium text-sm cursor-pointer"
								>
									{Content["userEditModal.deleteUserDialog.ban.label"]}
								</label>
								<p className="text-xs text-gray-600 mt-1">
									{Content["userEditModal.deleteUserDialog.ban.description"]}
								</p>
							</div>
						</div>

						<div className="flex items-start space-x-3">
							<input
								type="radio"
								id="delete"
								name="type"
								value="delete"
								checked={type === "delete"}
								onChange={(e) => setType(e.currentTarget.value as typeof type)}
								className="mt-1"
							/>
							<div className="flex-1">
								<label
									htmlFor="delete"
									className="font-medium text-sm cursor-pointer text-red-600"
								>
									{Content["userEditModal.deleteUserDialog.hardDelete.label"]}
								</label>
								<p className="text-xs text-red-500 mt-1">
									{
										Content[
											"userEditModal.deleteUserDialog.hardDelete.description"
										]
									}
								</p>
							</div>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleDeleteUser}
						className="hover:text-primary-foreground hover:bg-destructive/90 border-destructive/90"
					>
						{type === "delete"
							? Content["userEditModal.deleteUserDialog.button.delete"]
							: Content["userEditModal.deleteUserDialog.button.ban"]}
					</Button>
					<Button variant="default" onClick={() => handleDialogClose(false)}>
						{Content["userEditModal.deleteUserDialog.button.cancel"]}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
