import { crc32, deflateRawSync } from "node:zlib";

type ZipEntry = {
	name: string;
	content: string | Uint8Array;
	/** Uncompressed size written into the headers; defaults to the real size. Set it to fake a header. */
	declaredSize?: number;
};

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
const DEFLATE_METHOD = 8;
// 1980-01-01, the earliest date a ZIP header can hold
const DOS_DATE = 0x21;

/**
 * Builds a minimal ZIP archive in memory (Deflate, no ZIP64), so tests can
 * create .docx/.xlsx files of any unpacked size without committing binaries.
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
	const localParts: Buffer[] = [];
	const centralDirectoryParts: Buffer[] = [];
	let offset = 0;

	for (const { name, content, declaredSize } of entries) {
		const nameBytes = Buffer.from(name, "utf8");
		const rawBytes =
			typeof content === "string"
				? Buffer.from(content, "utf8")
				: Buffer.from(content);
		const uncompressedSize = declaredSize ?? rawBytes.length;
		const compressedBytes = deflateRawSync(rawBytes);
		const checksum = crc32(rawBytes);

		const localHeader = Buffer.alloc(30);
		localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
		localHeader.writeUInt16LE(ZIP_VERSION, 4);
		localHeader.writeUInt16LE(DEFLATE_METHOD, 8);
		localHeader.writeUInt16LE(DOS_DATE, 12);
		localHeader.writeUInt32LE(checksum, 14);
		localHeader.writeUInt32LE(compressedBytes.length, 18);
		localHeader.writeUInt32LE(uncompressedSize, 22);
		localHeader.writeUInt16LE(nameBytes.length, 26);

		const centralDirectoryHeader = Buffer.alloc(46);
		centralDirectoryHeader.writeUInt32LE(CENTRAL_DIRECTORY_HEADER_SIGNATURE, 0);
		centralDirectoryHeader.writeUInt16LE(ZIP_VERSION, 4);
		centralDirectoryHeader.writeUInt16LE(ZIP_VERSION, 6);
		centralDirectoryHeader.writeUInt16LE(DEFLATE_METHOD, 10);
		centralDirectoryHeader.writeUInt16LE(DOS_DATE, 14);
		centralDirectoryHeader.writeUInt32LE(checksum, 16);
		centralDirectoryHeader.writeUInt32LE(compressedBytes.length, 20);
		centralDirectoryHeader.writeUInt32LE(uncompressedSize, 24);
		centralDirectoryHeader.writeUInt16LE(nameBytes.length, 28);
		centralDirectoryHeader.writeUInt32LE(offset, 42);

		localParts.push(localHeader, nameBytes, compressedBytes);
		centralDirectoryParts.push(centralDirectoryHeader, nameBytes);
		offset += localHeader.length + nameBytes.length + compressedBytes.length;
	}

	const centralDirectory = Buffer.concat(centralDirectoryParts);
	const endOfCentralDirectory = Buffer.alloc(22);
	endOfCentralDirectory.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
	endOfCentralDirectory.writeUInt16LE(entries.length, 8);
	endOfCentralDirectory.writeUInt16LE(entries.length, 10);
	endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
	endOfCentralDirectory.writeUInt32LE(offset, 16);

	return new Uint8Array(
		Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]),
	);
}

const WORD_PARAGRAPH =
	"<w:p><w:r><w:rPr><w:sz w:val='20'/></w:rPr><w:t>Hallo Tabelle</w:t></w:r></w:p>";

/** Word XML of roughly the given size, as repetitive as real Word markup. */
export function wordXmlOfSize(byteCount: number): string {
	const repetitions = Math.ceil(byteCount / WORD_PARAGRAPH.length);
	return `<w:document><w:body>${WORD_PARAGRAPH.repeat(repetitions)}</w:body></w:document>`;
}

export function buildDocx({
	documentXml = wordXmlOfSize(1_000),
	media = [],
}: {
	documentXml?: string;
	media?: ZipEntry[];
} = {}): Uint8Array {
	return buildZip([
		{ name: "[Content_Types].xml", content: "<Types/>" },
		{ name: "word/document.xml", content: documentXml },
		...media,
	]);
}

export function buildXlsx({
	sheetXml = "<worksheet><sheetData/></worksheet>",
}: { sheetXml?: string } = {}): Uint8Array {
	return buildZip([
		{ name: "[Content_Types].xml", content: "<Types/>" },
		{ name: "xl/workbook.xml", content: "<workbook/>" },
		{ name: "xl/worksheets/sheet1.xml", content: sheetXml },
	]);
}
