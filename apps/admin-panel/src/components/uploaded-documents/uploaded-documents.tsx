import React from "react";
import Content from "../../content";
import { FileText } from "lucide-react";
import { UploadedDocumentItem } from "./uploaded-document-item";
import { useDocumentStore } from "../../store/use-document-store";

export const UploadedDocuments: React.FC = () => {
	const { documents } = useDocumentStore();

	// Sort documents alphabetically
	const sortedDocuments = [...documents].sort((a, b) =>
		(a.file_name || "").localeCompare(b.file_name || ""),
	);

	return (
		<div className="w-full self-start max-w-screen-xl border border-gray-200 rounded-lg p-4  mb-8">
			<div className="flex items-center gap-2">
				<FileText className="size-5" />
				<h2 className="text-lg font-semibold">
					{Content["baseKnowledge.uploadedPDF.title"]}
				</h2>
			</div>
			<div className="text-gray-500 text-sm">
				{Content["baseKnowledge.uploadedPDF.description"]}
			</div>
			<div className="mt-4 space-y-4">
				{sortedDocuments.length === 0 ? (
					<p className="text-muted-foreground text-center py-8">
						{Content["baseKnowledge.uploadedPDF.noDocuments"]}
					</p>
				) : (
					sortedDocuments.map((doc) => (
						<UploadedDocumentItem key={doc.id} document={doc} />
					))
				)}
			</div>
		</div>
	);
};
