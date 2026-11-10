import {
	isFailedUpload,
	isPendingUpload,
	UPLOAD_STATUS_MAP,
	type UploadStatusKeys,
} from "../../../store/use-file-uploads-store.ts";
import { useChatFileUploads } from "./hooks/use-chat-file-uploads.ts";
import Content from "../../../content.ts";

// Rendered unconditionally so the live region already exists when the
// status text changes, otherwise screen readers skip the first announcement.
export function FileUploadStatusAnnouncer() {
	const chatFileUploads = useChatFileUploads();

	return (
		<span role="status" aria-live="polite" className="sr-only">
			{getAnnouncement(chatFileUploads.map(({ status }) => status))}
		</span>
	);
}

function getAnnouncement(statuses: UploadStatusKeys[]) {
	if (statuses.some(isPendingUpload)) {
		return Content["fileUploadButtonStatus.uploading"];
	}
	if (statuses.some(isFailedUpload)) {
		return Content["fileUploadButtonStatus.failed"];
	}
	if (statuses.includes("successful")) {
		return Content["fileUploadButtonStatus.uploaded"];
	}
	if (statuses.includes("canceled")) {
		return UPLOAD_STATUS_MAP.canceled;
	}
	return "";
}
