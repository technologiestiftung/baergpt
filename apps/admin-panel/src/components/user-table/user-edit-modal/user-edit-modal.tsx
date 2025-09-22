import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { useUserStore } from "@/store/use-user-store";
import { UserInformationCard } from "./user-information-card";
import { DangerZoneCard } from "./danger-zone-card";
import { UserEditForm } from "./user-edit-form";
import Content from "../../../content";

export const UserEditModal: React.FC = () => {
	const { selectedUser, setSelectedUser } = useUserStore();

	const closeUserModal = () => {
		setSelectedUser(null);
	};

	return (
		<Dialog open={selectedUser !== null} onOpenChange={closeUserModal}>
			<DialogContent className="max-w-[95vw] rounded-lg md:max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{Content["userEditModal.title"]}</DialogTitle>
					<DialogDescription>
						{selectedUser &&
							`${selectedUser.first_name} ${selectedUser.last_name}`}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col md:flex-row gap-6 py-4">
					<UserEditForm />
					<UserInformationCard />
				</div>

				<DangerZoneCard />
			</DialogContent>
		</Dialog>
	);
};
