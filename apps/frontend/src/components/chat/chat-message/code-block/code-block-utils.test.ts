import { describe, it, expect } from "vitest";
import { getLanguageLabel } from "./code-block-utils.ts";

describe("getLanguageLabel", () => {
	it("returns the fence's language tag verbatim, with no display-name mapping", () => {
		expect(getLanguageLabel("language-python")).toBe("python");
		expect(getLanguageLabel("language-js")).toBe("js");
		expect(getLanguageLabel("language-sh")).toBe("sh");
	});

	it("reads the language from a className alongside the hljs class rehype-highlight adds", () => {
		expect(getLanguageLabel("hljs language-python")).toBe("python");
	});

	it("hides the label when no language class is present", () => {
		expect(getLanguageLabel(undefined)).toBeNull();
		expect(getLanguageLabel("")).toBeNull();
	});

	it("shows the label even for a language outside our highlighted set, just without highlighting", () => {
		expect(getLanguageLabel("language-rust")).toBe("rust");
	});
});
