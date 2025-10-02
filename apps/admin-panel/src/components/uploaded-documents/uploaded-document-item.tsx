import { Button } from "../ui/button";
import { FileText, Trash2 } from "lucide-react";
import Content from "../../content";
import type { Document } from "../../common";
import { useDocumentStore } from "../../store/use-document-store";
import { format } from "date-fns";

export const UploadedDocumentItem = ({ document }: { document: Document }) => {
	const { setDeleteDocumentDialogOpen, setSelectedDocument } =
		useDocumentStore();

	return (
		<div
			key={document.id}
			className="flex items-center justify-between p-4 border rounded-lg"
		>
			<div className="flex items-center gap-3 w-full truncate">
				<FileText className="size-8 text-gray-500 flex-shrink-0" />
				<div>
					<h4 className="font-medium truncate">{document.file_name}</h4>
					<div className="text-sm text-muted-foreground">
						<span>
							{Content["baseKnowledge.uploadedPDF.item.uploadedAt"]}{" "}
							{document.processing_finished_at
								? format(
										new Date(document.processing_finished_at),
										"dd-MM-yyyy",
									)
								: "N/A"}
						</span>
						<span className="mx-2">•</span>
						<span>
							{Content["baseKnowledge.uploadedPDF.item.size"]}{" "}
							{/* convert file size from byte to MB */}
							{document.file_size
								? (
										Math.round((document.file_size / 1048576) * 100) / 100
									).toFixed(2)
								: "0,00"}{" "}
							MB
						</span>
					</div>
				</div>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={() => {
					setSelectedDocument(document);
					setDeleteDocumentDialogOpen(true);
				}}
				className="text-destructive hover:text-destructive"
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
};
