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
import { useDocumentStore } from "@/store/use-document-store";
import Content from "../../content";
import { FileText } from "lucide-react";

export const DeleteDocumentDialog: React.FC = () => {
	const {
		selectedDocument,
		isDeleteDocumentDialogOpen,
		setSelectedDocument,
		setDeleteDocumentDialogOpen,
		deleteDocument,
		getDocuments,
	} = useDocumentStore();

	const deleteSelectedDocument = async () => {
		if (!selectedDocument) {
			return;
		}

		await deleteDocument(
			selectedDocument.id,
			selectedDocument.source_url,
			selectedDocument.owned_by_user_id ?? undefined,
		);

		setDeleteDocumentDialogOpen(false);
		setSelectedDocument(null);

		await getDocuments(new AbortController().signal); // Refresh document list after deletion
	};

	const handleDialogClose = (open: boolean) => {
		setDeleteDocumentDialogOpen(open);
	};

	return (
		<Dialog open={isDeleteDocumentDialogOpen} onOpenChange={handleDialogClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>
						{Content["baseKnowledge.deleteDialog.title"]}
					</DialogTitle>
					<DialogDescription>
						{Content["baseKnowledge.deleteDialog.description"]}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex gap-2 items-center">
						<FileText className="size-5 text-gray-500 flex-shrink-0" />
						{selectedDocument && (
							<span className="text-sm">{selectedDocument.file_name}</span>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={deleteSelectedDocument}
						className="hover:text-primary-foreground hover:bg-destructive/90 border-destructive/90"
					>
						{Content["baseKnowledge.deleteDialog.deleteDocumentButton.label"]}
					</Button>
					<Button variant="default" onClick={() => handleDialogClose(false)}>
						{Content["baseKnowledge.deleteDialog.cancelButton.label"]}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
