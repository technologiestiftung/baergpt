import React from "react";
import { Button } from "../ui/button";
import { X } from "lucide-react";
import { UPLOAD_STATUS_MAP } from "../../store/use-upload-document-store";

interface FileUploadItemProps {
	fileUpload: {
		file: File;
		status: keyof typeof UPLOAD_STATUS_MAP;
	};
	index: number;
	getStatusIcon: (status: keyof typeof UPLOAD_STATUS_MAP) => React.ReactNode;
	getTextColor: (status: keyof typeof UPLOAD_STATUS_MAP) => string;
	getStatusText: (status: keyof typeof UPLOAD_STATUS_MAP) => string;
	closeUploadStatus: (
		event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
		index: number,
	) => void;
}

const FileUploadItem: React.FC<FileUploadItemProps> = ({
	fileUpload,
	index,
	getStatusIcon,
	getTextColor,
	getStatusText,
	closeUploadStatus,
}) => {
	return (
		<div
			key={index}
			className="flex items-center justify-between p-2 border rounded-lg bg-muted/50 w-full"
		>
			<div className="flex items-center justify-between gap-2 w-full truncate">
				<div className="flex gap-2 text-sm items-center">
					{getStatusIcon(fileUpload.status)}
					<span className="font-medium max-w-40 truncate">
						{fileUpload.file.name}
					</span>
				</div>
				<span
					className={`flex gap-2 text-sm ${getTextColor(
						fileUpload.status,
					)} justify-end text-right`}
				>
					{getStatusText(fileUpload.status)}
				</span>
			</div>
			<Button
				variant="ghost"
				size="icon"
				onClick={(event) => closeUploadStatus(event, index)}
				className="h-6 w-6 self-end hover:bg-muted ml-2"
			>
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
};

export default FileUploadItem;
