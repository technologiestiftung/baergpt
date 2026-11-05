// Keep in sync with SUPPORTED_FILE_TYPES in the backend's validation-service.ts
export const SUPPORTED_UPLOAD_FILE_TYPES: Record<string, string[]> = {
	"application/pdf": [".pdf"],
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
		".docx",
	],
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
		".xlsx",
	],
	"text/csv": [".csv"],
	"text/markdown": [".md", ".markdown"],
};

export const SUPPORTED_UPLOAD_FILE_ACCEPT = Object.entries(
	SUPPORTED_UPLOAD_FILE_TYPES,
)
	.flat(2)
	.join(",");

export function isSupportedUploadFile(file: File) {
	const fileName = file.name.toLowerCase();
	return Object.entries(SUPPORTED_UPLOAD_FILE_TYPES).some(
		([mimeType, extensions]) =>
			file.type === mimeType ||
			extensions.some((extension) => fileName.endsWith(extension)),
	);
}
