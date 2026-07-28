import { describe, expect, it } from "vitest";
import {
	extractOpenDataSourcesFromToolOutput,
	type OpenDataMcpToolOutput,
} from "./open-data-mcp-tools";

function mcpOutput(text: string): OpenDataMcpToolOutput {
	return {
		content: [{ type: "text", text }],
	};
}

describe("extractOpenDataSourcesFromToolOutput", () => {
	it("parses search_berlin_datasets results with explicit URLs", () => {
		const text = `# Search Results for "Fahrrad"

## 1. Radzähldaten in Berlin
**ID**: radzahldaten-in-berlin
**URL**: https://daten.berlin.de/datensaetze/radzahldaten-in-berlin
**Organization**: SenMVKU

## 2. SimRa Fahrten
**ID**: simra
**URL**: https://daten.berlin.de/datensaetze/simra
**Organization**: SimRa-Projekt`;

		const sources = extractOpenDataSourcesFromToolOutput(
			{ query: "Fahrrad" },
			mcpOutput(text),
		);

		expect(sources).toHaveLength(2);
		expect(sources[0]).toEqual({
			title: "Radzähldaten in Berlin",
			datasetId: "radzahldaten-in-berlin",
			url: "https://daten.berlin.de/datensaetze/radzahldaten-in-berlin",
		});
		expect(sources[1]).toEqual({
			title: "SimRa Fahrten",
			datasetId: "simra",
			url: "https://daten.berlin.de/datensaetze/simra",
		});
	});

	it("parses search_datasets_filtered results with ID-only blocks", () => {
		const text = `# Filtered Search: "Fahrrad"

## 1. Radzähldaten in Berlin
**ID**: radzahldaten-in-berlin
**Organization**: SenMVKU

## 2. SimRa Fahrten
**ID**: simra
**Organization**: SimRa-Projekt`;

		const sources = extractOpenDataSourcesFromToolOutput(
			{ query: "Fahrrad" },
			mcpOutput(text),
		);

		expect(sources).toHaveLength(2);
		expect(sources[0]).toEqual({
			title: "Radzähldaten in Berlin",
			datasetId: "radzahldaten-in-berlin",
			url: "https://daten.berlin.de/datensaetze/radzahldaten-in-berlin",
		});
		expect(sources[1]).toEqual({
			title: "SimRa Fahrten",
			datasetId: "simra",
			url: "https://daten.berlin.de/datensaetze/simra",
		});
	});

	it("deduplicates when the same dataset appears with and without URL", () => {
		const text = `## 1. Radzähldaten in Berlin
**ID**: radzahldaten-in-berlin
**URL**: https://daten.berlin.de/datensaetze/radzahldaten-in-berlin

## 2. Radzähldaten in Berlin
**ID**: radzahldaten-in-berlin
**Organization**: SenMVKU`;

		const sources = extractOpenDataSourcesFromToolOutput({}, mcpOutput(text));

		expect(sources).toHaveLength(1);
		expect(sources[0].url).toBe(
			"https://daten.berlin.de/datensaetze/radzahldaten-in-berlin",
		);
	});

	it("parses get_dataset_details output", () => {
		const text = `# Radzähldaten in Berlin

## Overview
**ID**: radzahldaten-in-berlin
**Portal URL**: https://daten.berlin.de/datensaetze/radzahldaten-in-berlin`;

		const sources = extractOpenDataSourcesFromToolOutput(
			{ dataset_id: "radzahldaten-in-berlin" },
			mcpOutput(text),
		);

		expect(sources).toEqual([
			{
				title: "Radzähldaten in Berlin",
				datasetId: "radzahldaten-in-berlin",
				url: "https://daten.berlin.de/datensaetze/radzahldaten-in-berlin",
			},
		]);
	});

	it("falls back to dataset_id from input when response has no parseable blocks", () => {
		const sources = extractOpenDataSourcesFromToolOutput(
			{ dataset_id: "radzahldaten-in-berlin" },
			mcpOutput("# Data from: Radzähldaten in Berlin\n\n| col | val |\n"),
		);

		expect(sources).toEqual([
			{
				title: "Radzähldaten in Berlin",
				datasetId: "radzahldaten-in-berlin",
				url: "https://daten.berlin.de/datensaetze/radzahldaten-in-berlin",
			},
		]);
	});

	it("returns empty array for non-matching text without dataset_id input", () => {
		const sources = extractOpenDataSourcesFromToolOutput(
			{ query: "Fahrrad" },
			mcpOutput("No datasets found."),
		);

		expect(sources).toEqual([]);
	});
});
