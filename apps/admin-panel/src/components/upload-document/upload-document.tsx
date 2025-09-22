import React, { useRef } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Upload } from "lucide-react";
import {
	CheckCircle,
	Loader2,
	AlertTriangle,
	ChevronDown,
	ChevronUp,
} from "lucide-react";
import { Label } from "../ui/label";
import Content from "../../content";
import {
	useFileUploadsStore,
	UPLOAD_STATUS_MAP,
} from "../../store/use-upload-document-store";
import FileUploadItem from "./file-upload-item";
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "../ui/accordion";
import { FileUploadStatus } from "./file-upload-status";

const getStatusText = (status: keyof typeof UPLOAD_STATUS_MAP): string => {
	return UPLOAD_STATUS_MAP[status] || "";
};

const getStatusIcon = (status: string): React.ReactNode => {
	if (status === "successful") {
		return <CheckCircle className="size-4 text-green-500" />;
	}
	if (status === "uploading" || status === "processing") {
		return <Loader2 className="size-4 animate-spin" />;
	}
	if (
		status === "failed.generic" ||
		status === "failed.duplicate" ||
		status === "failed.format" ||
		status === "failed.size"
	) {
		return <AlertTriangle className="size-4 text-red-500" />;
	}
	return null;
};

const getTextColor = (status: string): string => {
	if (status.startsWith("failed")) {
		return "text-red-500";
	}
	if (status === "successful") {
		return "text-green-500";
	}
	return "text-gray-500";
};

export const UploadDocument: React.FC = () => {
	const { uploadFiles, fileUploads } = useFileUploadsStore();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileSelect = async (
		event: React.ChangeEvent<HTMLInputElement>,
	) => {
		const files = event.target.files;
		if (files && files.length > 0) {
			await uploadFiles(Array.from(files)).catch(console.error);
		}
	};

	function closeUploadStatus(
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
		index: number,
	): void {
		event.preventDefault();
		useFileUploadsStore.getState().removeFileUpload(index);
	}

	return (
		<div className="w-full self-start max-w-screen-xl border border-gray-200 rounded-lg p-4 mb-8">
			<div className="flex items-center gap-2">
				<Upload className="size-5" />
				<h2 className="text-lg font-semibold">
					{Content["baseKnowledge.uploadPDF.title"]}
				</h2>
			</div>
			<div className="text-gray-500 text-sm">
				{Content["baseKnowledge.uploadPDF.description"]}
			</div>
			<div className="flex flex-col justify-start gap-x-4 space-y-4 mt-4">
				<div className="space-y-3">
					<Label className="font-semibold" htmlFor="pdf-upload">
						{Content["baseKnowledge.uploadPDF.label"]}
					</Label>
					<div className="relative">
						<Button
							onClick={() => fileInputRef.current?.click()}
							className="max-w-sm w-full"
						>
							{Content["baseKnowledge.uploadPDF.button.label"]}
							<Upload className="h-4 w-4 ml-2" />
						</Button>
						<Input
							ref={fileInputRef}
							id="pdf-upload"
							type="file"
							accept="application/pdf"
							multiple
							className="hidden"
							onChange={handleFileSelect}
						/>
					</div>
					{fileUploads.length > 0 && (
						<Accordion
							type="single"
							collapsible
							className="w-full max-w-sm"
							defaultValue="uploads"
						>
							<AccordionItem value="uploads" className="border rounded-lg">
								<AccordionTrigger className="group w-full flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg">
									<FileUploadStatus />
									<span className="ml-2 flex items-center">
										<ChevronDown className="inline-block group-data-[state=open]:hidden" />
										<ChevronUp className="hidden group-data-[state=open]:inline-block" />
									</span>
								</AccordionTrigger>

								<AccordionContent className="p-3 bg-muted/50 rounded-b-lg">
									<div className="flex flex-col gap-2">
										{fileUploads.map((fileUpload, index) => (
											<FileUploadItem
												key={index}
												fileUpload={fileUpload}
												index={index}
												getStatusIcon={getStatusIcon}
												getTextColor={getTextColor}
												getStatusText={getStatusText}
												closeUploadStatus={closeUploadStatus}
											/>
										))}
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					)}
				</div>
			</div>
		</div>
	);
};
