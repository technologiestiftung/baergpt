import React from "react";
import { Layout } from "../../components/layout/layout.tsx";
import { AdminSidebar } from "../../components/admin-sidebar/admin-sidebar.tsx";
import { AddNewDomainForm } from "../../components/add-new-domain-form/add-new-domain-form.tsx";

export const DomainAllowlistPage: React.FC = () => {
	return (
		<Layout>
			<AdminSidebar>
				<div className="w-full max-w-screen-xl p-4">
					<AddNewDomainForm />
				</div>
			</AdminSidebar>
		</Layout>
	);
};
