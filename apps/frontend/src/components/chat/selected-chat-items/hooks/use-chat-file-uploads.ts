import { useShallow } from "zustand/react/shallow";
import {
	isFailedUpload,
	isPendingUpload,
	useFileUploadsStore,
} from "../../../../store/use-file-uploads-store.ts";

export function useChatFileUploads() {
	return useFileUploadsStore(
		useShallow(({ fileUploads }) =>
			fileUploads.filter(({ isRemovedFromChat }) => !isRemovedFromChat),
		),
	);
}

export function useChatFileUploadPills() {
	return useFileUploadsStore(
		useShallow(({ fileUploads }) =>
			fileUploads.filter(
				({ status, isRemovedFromChat }) =>
					!isRemovedFromChat &&
					(isPendingUpload(status) || isFailedUpload(status)),
			),
		),
	);
}
