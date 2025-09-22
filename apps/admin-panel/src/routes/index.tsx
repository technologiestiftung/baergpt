import React from "react";
import { Layout } from "../components/layout/layout.tsx";
import { AdminSidebar } from "../components/admin-sidebar/admin-sidebar.tsx";
import { UsersTable } from "../components/user-table/users-table.tsx";
import { UserEditModal } from "../components/user-table/user-edit-modal/user-edit-modal.tsx";
import { DeleteUserDialog } from "../components/user-table/user-edit-modal/delete-user-dialog.tsx";
import { RestoreUserDialog } from "../components/user-table/user-edit-modal/restore-user-dialog.tsx";

export const IndexPage: React.FC = () => {
	return (
		<Layout>
			<AdminSidebar>
				<div className="p-4">
					<div className="flex flex-col items-center justify-center w-full">
						<UsersTable />
					</div>
				</div>
				<UserEditModal />
				<DeleteUserDialog />
				<RestoreUserDialog />
			</AdminSidebar>
		</Layout>
	);
};
