import { describe, expect, it } from "vitest";
import { getSortedItems } from "./get-sorted-items.ts";
import { getListItemName } from "./get-list-item-name.ts";
import type { UserDocument, UserFolder } from "../../../../../common.ts";

let nextId = 1;

const doc = (file_name: string | null, source_url = ""): UserDocument => ({
	created_at: null,
	file_checksum: null,
	file_name,
	file_size: null,
	folder_id: null,
	id: nextId++,
	num_pages: null,
	owned_by_user_id: null,
	processing_finished_at: null,
	source_type: "personal_document",
	source_url,
});

const folder = (name: string): UserFolder => ({
	created_at: "",
	id: nextId++,
	name,
	user_id: "",
});

const sortDocNames = (names: string[]) =>
	getSortedItems(names.map((name) => doc(name))).map((item) => item.file_name);

describe("getSortedItems", () => {
	it("sorts numbers within names by value", () => {
		const names = [1, 10, 11, 12, 2, 3, 9].map((n) => `document-${n}.pdf`);
		expect(sortDocNames(names)).toEqual(
			[1, 2, 3, 9, 10, 11, 12].map((n) => `document-${n}.pdf`),
		);
	});

	it("lists folders before documents", () => {
		const items = [doc("a.pdf"), folder("Z"), doc("b.pdf"), folder("A")];
		expect(getSortedItems(items).map(getListItemName)).toEqual([
			"A",
			"Z",
			"a.pdf",
			"b.pdf",
		]);
	});

	it("ignores case and sorts umlauts with their base letter", () => {
		expect(sortDocNames(["Zebra.pdf", "Ärger.pdf", "apfel.pdf"])).toEqual([
			"apfel.pdf",
			"Ärger.pdf",
			"Zebra.pdf",
		]);
	});

	it("orders names that differ only in case or leading zeros deterministically", () => {
		expect(sortDocNames(["Bericht.pdf", "bericht.pdf"])).toEqual(
			sortDocNames(["bericht.pdf", "Bericht.pdf"]),
		);
		expect(sortDocNames(["Anlage-1.pdf", "Anlage-01.pdf"])).toEqual(
			sortDocNames(["Anlage-01.pdf", "Anlage-1.pdf"]),
		);
	});

	it("falls back to the source url when the file name is missing", () => {
		const items = [doc("b.pdf"), doc(null, "a-url.pdf")];
		expect(getSortedItems(items).map(getListItemName)).toEqual([
			"a-url.pdf",
			"b.pdf",
		]);
	});

	it("does not mutate the input array", () => {
		const items = [doc("b.pdf"), doc("a.pdf")];
		const copy = [...items];
		getSortedItems(items);
		expect(items).toEqual(copy);
	});
});
