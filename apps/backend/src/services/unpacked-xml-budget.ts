import { finished } from "node:stream/promises";
import { fromBufferPromise, type Entry, type ZipFile } from "yauzl";
import { config } from "../config";
import { createBufferView } from "../utils";

const BYTES_PER_MB = 1024 * 1024;

/**
 * .docx and .xlsx files are ZIP archives of XML. Parsing that XML costs about
 * 35 MB of RAM per MB, synchronously and in the process shared by all requests,
 * so the upload size says little about what an extraction needs.
 *
 * Rejects a file before mammoth or SheetJS touch it when its XML would exceed
 * the budget:
 * 1. by the sizes the ZIP directory declares, which costs no unpacking;
 * 2. by unpacking each XML part once as a stream and discarding the bytes,
 *    because declared sizes can be faked. yauzl's `validateEntrySizes` aborts
 *    as soon as an entry yields more bytes than it declared, so after step 1
 *    the real size can never exceed the budget either.
 */
export async function assertUnpackedXmlWithinBudget(
	fileBytes: Uint8Array,
): Promise<void> {
	const budgetBytes = config.maxUnpackedXmlMb * BYTES_PER_MB;
	const { zipFile, xmlEntries } = await readXmlEntries(fileBytes);

	const declaredXmlBytes = xmlEntries.reduce(
		(total, { uncompressedSize }) => total + uncompressedSize,
		0,
	);
	if (declaredXmlBytes > budgetBytes) {
		throw new Error("failed.tooComplex", {
			cause: `file declares ${declaredXmlBytes} bytes of XML (budget ${budgetBytes})`,
		});
	}

	for (const entry of xmlEntries) {
		await drainEntry(zipFile, entry);
	}
}

async function readXmlEntries(
	fileBytes: Uint8Array,
): Promise<{ zipFile: ZipFile; xmlEntries: Entry[] }> {
	try {
		const zipFile = await fromBufferPromise(createBufferView(fileBytes), {
			validateEntrySizes: true,
		});
		const xmlEntries: Entry[] = [];
		for await (const entry of zipFile.eachEntry()) {
			if (entry.fileName.toLowerCase().endsWith(".xml")) {
				xmlEntries.push(entry);
			}
		}
		return { zipFile, xmlEntries };
	} catch (error) {
		throw new Error("failed.format", { cause: error });
	}
}

async function drainEntry(zipFile: ZipFile, entry: Entry): Promise<void> {
	try {
		const readStream = await zipFile.openReadStreamPromise(entry);
		// Only the byte count matters, and yauzl checks it while the bytes
		// flow, so the data itself is discarded
		readStream.resume();
		await finished(readStream);
	} catch (error) {
		// Invalid data, unsupported compression, encryption, or a size that
		// doesn't match the declared one
		throw new Error("failed.format", { cause: error });
	}
}
