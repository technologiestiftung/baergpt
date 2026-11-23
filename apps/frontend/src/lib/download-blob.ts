// Revoking sooner can abort large downloads in Firefox and Safari
const REVOKE_DELAY_MS = 40_000;

export function downloadUrl(url: string, fileName: string) {
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();
}

export function downloadBlob(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob);
	downloadUrl(url, fileName);
	setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
