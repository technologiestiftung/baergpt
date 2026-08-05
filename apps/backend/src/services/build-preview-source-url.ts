import { randomUUID } from "crypto";

export function buildPreviewSourceUrl(sourceUrl: string): string {
	const segments = sourceUrl.split("/");
	segments[segments.length - 1] = `${randomUUID()}.pdf`;
	return segments.join("/");
}
