import { Hono } from "hono";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
import type {
	MatomoDashboardStats,
	MatomoDeviceMonthlyTrendPoint,
	MatomoPercentageEntry,
} from "../types/matomo";

// No own adminAuth: inherited from routes/admin.ts, where this sub-app is mounted.
const matomo = new Hono();

const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 12 * 60 * 1000;
const STATS_WINDOW_DAYS = 30;
const PROFILE_PAGE_PATH = "/profile/";
const DEVICE_TREND_MONTHS = 6;
const TOP_OS_COUNT = 5;
const TOP_BROWSER_COUNT = 5;
const EXPECTED_BULK_RESULT_COUNT = 4 + DEVICE_TREND_MONTHS;

const UNAVAILABLE_STATS: MatomoDashboardStats = {
	available: false,
	averageSessionDurationSeconds: 0,
	profilePageViews: 0,
	deviceMonthlyTrend: [],
	osBreakdown: [],
	browserBreakdown: [],
};

type MatomoVisitsSummaryResult = { avg_time_on_site?: number };
type MatomoPageUrlRow = { label?: string; nb_hits?: number };
type MatomoBreakdownRow = { label?: string; nb_visits?: number };
const OTHER_LABEL = "Andere";
type MatomoErrorResult = { result: "error"; message?: string };

let cache: { stats: MatomoDashboardStats; expiresAt: number } | null = null;

function toDateParam(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function getBerlinYearMonth(date: Date): { year: number; month: number } {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "Europe/Berlin",
		year: "numeric",
		month: "numeric",
	}).formatToParts(date);

	return {
		year: Number(parts.find((part) => part.type === "year")?.value),
		month: Number(parts.find((part) => part.type === "month")?.value),
	};
}

export function getCompletedMonthsWindow(
	referenceDate: Date,
	count: number,
): string[] {
	const { year, month } = getBerlinYearMonth(referenceDate);
	const months: string[] = [];
	for (let i = count; i >= 1; i--) {
		months.push(toDateParam(new Date(Date.UTC(year, month - 1 - i, 1))));
	}
	return months;
}

function getStatsWindow(): { fromDate: string; toDate: string } {
	const toDate = new Date();
	const fromDate = new Date(toDate);
	fromDate.setDate(fromDate.getDate() - (STATS_WINDOW_DAYS - 1));
	return { fromDate: toDateParam(fromDate), toDate: toDateParam(toDate) };
}

function buildBulkRequestBody(monthStarts: string[]): URLSearchParams {
	const { fromDate, toDate } = getStatsWindow();
	const commonParams = `idSite=${config.matomoSiteId}&period=range&date=${fromDate},${toDate}`;

	const subRequests = [
		`method=VisitsSummary.get&${commonParams}`,
		`method=Actions.getPageUrls&flat=1&filter_limit=-1&${commonParams}`,
		`method=DevicesDetection.getOsFamilies&${commonParams}`,
		`method=DevicesDetection.getBrowsers&${commonParams}`,
		...monthStarts.map(
			(date) =>
				`method=DevicesDetection.getType&idSite=${config.matomoSiteId}&period=month&date=${date}`,
		),
	];

	const body = new URLSearchParams();
	body.set("module", "API");
	body.set("method", "API.getBulkRequest");
	body.set("format", "JSON");
	body.set("token_auth", config.matomoTokenAuth as string);
	subRequests.forEach((url, index) => body.set(`urls[${index}]`, url));

	return body;
}

function isErrorResult(value: unknown): value is MatomoErrorResult {
	return (
		typeof value === "object" &&
		value !== null &&
		(value as { result?: unknown }).result === "error"
	);
}

function findProfilePageViews(rows: unknown): number {
	if (!Array.isArray(rows)) {
		return 0;
	}

	const profileRow = (rows as MatomoPageUrlRow[]).find(
		(row) => row.label === PROFILE_PAGE_PATH,
	);

	return profileRow?.nb_hits ?? 0;
}

const DEVICE_LABEL_MAP: Record<string, "desktop" | "mobile" | "tablet"> = {
	Desktop: "desktop",
	Smartphone: "mobile",
	Tablet: "tablet",
};

export function toDeviceTrendPoint(
	month: string,
	rows: unknown,
): MatomoDeviceMonthlyTrendPoint {
	const point: MatomoDeviceMonthlyTrendPoint = {
		month,
		desktop: 0,
		mobile: 0,
		tablet: 0,
	};

	if (!Array.isArray(rows)) {
		return point;
	}

	for (const row of rows as MatomoBreakdownRow[]) {
		const key = row.label ? DEVICE_LABEL_MAP[row.label] : undefined;
		if (key) {
			point[key] = row.nb_visits ?? 0;
		}
	}

	return point;
}

export function toPercentageBreakdown(
	rows: unknown,
	{ topN }: { topN: number },
): MatomoPercentageEntry[] {
	if (!Array.isArray(rows)) {
		return [];
	}

	// Matomo omits nb_uniq_visitors for period=range, so nb_visits is used.
	const entries = (rows as MatomoBreakdownRow[])
		.filter(
			(row): row is MatomoBreakdownRow & { label: string } =>
				typeof row.label === "string",
		)
		.map((row) => ({ label: row.label, value: row.nb_visits ?? 0 }))
		.sort((a, b) => b.value - a.value);

	const total = entries.reduce((sum, entry) => sum + entry.value, 0);

	if (total === 0) {
		return [];
	}

	const toPercentage = (value: number) => Math.round((value / total) * 100);

	const result = entries.slice(0, topN).map((entry) => ({
		label: entry.label,
		percentage: toPercentage(entry.value),
	}));

	const rest = entries.slice(topN);
	if (rest.length > 0) {
		const otherValue = rest.reduce((sum, entry) => sum + entry.value, 0);
		result.push({ label: OTHER_LABEL, percentage: toPercentage(otherValue) });
	}

	return result;
}

async function fetchMatomoStats(): Promise<MatomoDashboardStats> {
	const monthStarts = getCompletedMonthsWindow(new Date(), DEVICE_TREND_MONTHS);
	const matomoBaseUrl = (config.matomoUrl as string).replace(/\/+$/, "");
	const response = await fetch(`${matomoBaseUrl}/index.php`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: buildBulkRequestBody(monthStarts),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok) {
		captureError(
			new Error(`Matomo bulk request failed with status ${response.status}`),
		);
		return UNAVAILABLE_STATS;
	}

	const bulkResults = (await response.json()) as unknown[];

	if (
		!Array.isArray(bulkResults) ||
		bulkResults.length !== EXPECTED_BULK_RESULT_COUNT ||
		bulkResults.some((result) => result === undefined || isErrorResult(result))
	) {
		captureError(new Error("Matomo bulk request returned an unexpected shape"));
		return UNAVAILABLE_STATS;
	}

	const [visitsSummary, pageUrls, osFamilies, browsers, ...deviceMonthlyRows] =
		bulkResults;

	return {
		available: true,
		averageSessionDurationSeconds:
			(visitsSummary as MatomoVisitsSummaryResult)?.avg_time_on_site ?? 0,
		profilePageViews: findProfilePageViews(pageUrls),
		deviceMonthlyTrend: monthStarts.map((month, index) =>
			toDeviceTrendPoint(month, deviceMonthlyRows[index]),
		),
		osBreakdown: toPercentageBreakdown(osFamilies, { topN: TOP_OS_COUNT }),
		browserBreakdown: toPercentageBreakdown(browsers, {
			topN: TOP_BROWSER_COUNT,
		}),
	};
}

export async function getMatomoDashboardStats(): Promise<MatomoDashboardStats> {
	if (!config.matomoUrl || !config.matomoSiteId || !config.matomoTokenAuth) {
		return UNAVAILABLE_STATS;
	}

	if (cache && cache.expiresAt > Date.now()) {
		return cache.stats;
	}

	let stats: MatomoDashboardStats;
	try {
		stats = await fetchMatomoStats();
	} catch (error) {
		captureError(error);
		stats = UNAVAILABLE_STATS;
	}

	if (stats.available) {
		cache = { stats, expiresAt: Date.now() + CACHE_TTL_MS };
	}

	return stats;
}

export function resetMatomoStatsCacheForTests(): void {
	cache = null;
}

matomo.get("/matomo-stats", async (c) => {
	try {
		return c.json(await getMatomoDashboardStats());
	} catch (error) {
		captureError(error);
		return c.json(UNAVAILABLE_STATS);
	}
});

export default matomo;
