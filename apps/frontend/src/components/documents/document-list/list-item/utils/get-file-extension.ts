export const getFileExtension = (fileName: string): string => {
	const extensionStart = fileName.lastIndexOf(".");
	return extensionStart > 0 ? fileName.slice(extensionStart) : "";
};
