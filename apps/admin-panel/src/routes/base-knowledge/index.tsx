import React from "react";
import { Layout } from "../../components/layout/layout.tsx";
import { AdminSidebar } from "../../components/admin-sidebar/admin-sidebar.tsx";
import { UploadDocument } from "@/components/upload-document/upload-document.tsx";
import { UploadedDocuments } from "@/components/uploaded-documents/uploaded-documents.tsx";
import { DeleteDocumentDialog } from "@/components/uploaded-documents/delete-document-dialog.tsx";

export const BaseKnowledgePage: React.FC = () => {
	return (
		<Layout>
			<AdminSidebar>
				<div className="w-full max-w-screen-xl p-4">
					<UploadDocument />
					<UploadedDocuments />
				</div>
			</AdminSidebar>
			<DeleteDocumentDialog />
		</Layout>
	);
};
