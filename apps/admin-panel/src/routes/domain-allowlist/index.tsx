import React from "react";
import { Layout } from "../../components/layout/layout.tsx";
import { AdminSidebar } from "../../components/admin-sidebar/admin-sidebar.tsx";
import { DomainManagement } from "../../components/domain-management/domain-management.tsx";

export const DomainAllowlistPage: React.FC = () => {
	return (
		<Layout>
			<AdminSidebar>
				<DomainManagement />
			</AdminSidebar>
		</Layout>
	);
};
