import React from "react";
import { Layout } from "../components/layout/layout.tsx";
import { AdminSidebar } from "../components/admin-sidebar/admin-sidebar.tsx";
import { UsersTable } from "../components/user-table/users-table.tsx";
import { UserEditModal } from "../components/user-table/user-edit-modal/user-edit-modal.tsx";
import { BanOrDeleteUserDialog } from "../components/user-table/user-edit-modal/ban-or-delete-user-dialog.tsx";
import { UnbanUserDialog } from "../components/user-table/user-edit-modal/unban-user-dialog.tsx";

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
				<BanOrDeleteUserDialog />
				<UnbanUserDialog />
			</AdminSidebar>
		</Layout>
	);
};
