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

export const DeleteUserDialog: React.FC = () => {
	const {
		selectedUser,
		isDeleteUserDialogOpen,
		setSelectedUser,
		setDeleteUserDialogOpen,
		deleteUser,
		getUsers,
	} = useUserStore();

	const [deleteType, setDeleteType] = useState<"soft" | "hard">("soft");

	const handleDeleteUser = async () => {
		if (!selectedUser) {
			return;
		}

		const hardDelete = deleteType === "hard";
		await deleteUser(selectedUser.user_id, hardDelete);

		setDeleteUserDialogOpen(false);
		setSelectedUser(null);
		setDeleteType("soft"); // Reset to default

		await getUsers(new AbortController().signal); // Refresh user list after deletion
	};

	const handleDialogClose = (open: boolean) => {
		setDeleteUserDialogOpen(open);
		if (!open) {
			setDeleteType("soft"); // Reset to default when closing
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
								id="soft-delete"
								name="deleteType"
								value="soft"
								checked={deleteType === "soft"}
								onChange={(e) =>
									setDeleteType(e.target.value as "soft" | "hard")
								}
								className="mt-1"
							/>
							<div className="flex-1">
								<label
									htmlFor="soft-delete"
									className="font-medium text-sm cursor-pointer"
								>
									{Content["userEditModal.deleteUserDialog.softDelete.label"]}
								</label>
								<p className="text-xs text-gray-600 mt-1">
									{
										Content[
											"userEditModal.deleteUserDialog.softDelete.description"
										]
									}
								</p>
							</div>
						</div>

						<div className="flex items-start space-x-3">
							<input
								type="radio"
								id="hard-delete"
								name="deleteType"
								value="hard"
								checked={deleteType === "hard"}
								onChange={(e) =>
									setDeleteType(e.target.value as "soft" | "hard")
								}
								className="mt-1"
							/>
							<div className="flex-1">
								<label
									htmlFor="hard-delete"
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
						{deleteType === "hard"
							? Content["userEditModal.deleteUserDialog.button.hardDelete"]
							: Content["userEditModal.deleteUserDialog.button.softDelete"]}
					</Button>
					<Button variant="default" onClick={() => handleDialogClose(false)}>
						{Content["userEditModal.deleteUserDialog.button.cancel"]}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
