import crypto from "crypto";

export function getHash(documentBuffer: Uint8Array): string {
	const hashSum = crypto.createHash("md5");
	hashSum.update(documentBuffer);
	const hex = hashSum.digest("hex");
	return hex;
}

export function createBufferView(uint8Array: Uint8Array): Buffer {
	// this is a trick so the document is not stored twice in memory
	return Buffer.from(
		uint8Array.buffer,
		uint8Array.byteOffset,
		uint8Array.byteLength,
	);
}
