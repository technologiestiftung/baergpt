import { describe, it, expect } from "vitest";
import {
	findProfilePageViews,
	getCompletedMonthsWindow,
	toDeviceTrendPoint,
	toPercentageBreakdown,
} from "./matomo";

describe("getCompletedMonthsWindow", () => {
	it("returns the last N fully completed months, ascending, excluding the reference month", () => {
		const referenceDate = new Date("2026-11-05T12:00:00Z");

		expect(getCompletedMonthsWindow(referenceDate, 6)).toEqual([
			"2026-05-01",
			"2026-06-01",
			"2026-07-01",
			"2026-08-01",
			"2026-09-01",
			"2026-10-01",
		]);
	});

	it("uses Europe/Berlin's calendar date, not the server's UTC date, to decide the current month", () => {
		const referenceDate = new Date("2026-11-30T23:30:00Z");

		expect(getCompletedMonthsWindow(referenceDate, 6)).toEqual([
			"2026-06-01",
			"2026-07-01",
			"2026-08-01",
			"2026-09-01",
			"2026-10-01",
			"2026-11-01",
		]);
	});

	it("rolls over the year boundary correctly", () => {
		const referenceDate = new Date("2026-02-10T12:00:00Z");

		expect(getCompletedMonthsWindow(referenceDate, 6)).toEqual([
			"2025-08-01",
			"2025-09-01",
			"2025-10-01",
			"2025-11-01",
			"2025-12-01",
			"2026-01-01",
		]);
	});
});

describe("toDeviceTrendPoint", () => {
	it("maps Matomo device labels onto desktop/mobile/tablet, dropping other categories", () => {
		expect(
			toDeviceTrendPoint("2026-10-01", [
				{ label: "Desktop", nb_visits: 80 },
				{ label: "Smartphone", nb_visits: 15 },
				{ label: "Tablet", nb_visits: 5 },
				{ label: "Tv", nb_visits: 3 },
				{ label: "Unknown", nb_visits: 1 },
			]),
		).toEqual({ month: "2026-10-01", desktop: 80, mobile: 15, tablet: 5 });
	});

	it("defaults missing categories to 0", () => {
		expect(
			toDeviceTrendPoint("2026-10-01", [{ label: "Desktop", nb_visits: 80 }]),
		).toEqual({ month: "2026-10-01", desktop: 80, mobile: 0, tablet: 0 });
	});

	it("returns an all-zero point when rows isn't an array", () => {
		expect(toDeviceTrendPoint("2026-10-01", undefined)).toEqual({
			month: "2026-10-01",
			desktop: 0,
			mobile: 0,
			tablet: 0,
		});
	});
});

describe("toPercentageBreakdown", () => {
	it("converts each row's share of the total to a rounded percentage when there are exactly topN rows", () => {
		const rows = [
			{ label: "Windows", nb_visits: 50 },
			{ label: "macOS", nb_visits: 30 },
			{ label: "Linux", nb_visits: 20 },
		];

		expect(toPercentageBreakdown(rows, { topN: 3 })).toEqual([
			{ label: "Windows", percentage: 50 },
			{ label: "macOS", percentage: 30 },
			{ label: "Linux", percentage: 20 },
		]);
	});

	it("groups everything past topN into a single 'Andere' bucket, sized by its share of the grand total", () => {
		const rows = [
			{ label: "Windows", nb_visits: 50 },
			{ label: "macOS", nb_visits: 30 },
			{ label: "Linux", nb_visits: 20 },
		];

		expect(toPercentageBreakdown(rows, { topN: 2 })).toEqual([
			{ label: "Windows", percentage: 50 },
			{ label: "macOS", percentage: 30 },
			{ label: "Andere", percentage: 20 },
		]);
	});

	it("sorts rows descending by nb_visits regardless of input order", () => {
		const rows = [
			{ label: "iOS", nb_visits: 20 },
			{ label: "Android", nb_visits: 80 },
		];

		expect(toPercentageBreakdown(rows, { topN: 2 })).toEqual([
			{ label: "Android", percentage: 80 },
			{ label: "iOS", percentage: 20 },
		]);
	});

	it("rounds percentages to the nearest whole number", () => {
		const rows = [
			{ label: "A", nb_visits: 2 },
			{ label: "B", nb_visits: 1 },
		];

		expect(toPercentageBreakdown(rows, { topN: 2 })).toEqual([
			{ label: "A", percentage: 67 },
			{ label: "B", percentage: 33 },
		]);
	});

	it("returns an empty array when rows isn't an array", () => {
		expect(toPercentageBreakdown(undefined, { topN: 5 })).toEqual([]);
	});

	it("returns an empty array when the total is 0", () => {
		const rows = [{ label: "Windows", nb_visits: 0 }];

		expect(toPercentageBreakdown(rows, { topN: 5 })).toEqual([]);
	});
});

describe("findProfilePageViews", () => {
	it("sums hits for the profile path with and without trailing slash", () => {
		expect(
			findProfilePageViews([
				{ label: "/profile/", nb_hits: 42 },
				{ label: "/profile", nb_hits: 8 },
				{ label: "/profile" },
				{ label: "/profile-other", nb_hits: 100 },
				{ nb_hits: 5 },
			]),
		).toBe(50);
	});

	it("returns 0 for non-array input", () => {
		expect(findProfilePageViews(undefined)).toBe(0);
	});
});
