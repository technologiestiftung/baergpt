/**
 * Render Log Shipper
 *
 * Polls Render's REST API for logs from specified services
 * and pushes them to STACKIT Observability's Loki endpoint.
 *
 * Env vars: RENDER_API_KEY, RENDER_OWNER_ID, RENDER_RESOURCE_IDS,
 *           LOKI_PUSH_URL, LOKI_USERNAME, LOKI_PASSWORD, POLL_INTERVAL_SECONDS
 */

const RENDER_LOGS_URL = "https://api.render.com/v1/logs";
const MAX_PAGES = 10;
const LOGS_PER_PAGE = "100";
const NANOSECOND_SUFFIX = "000000";
const CURSOR_ADVANCE_MS = 1;
const REQUEST_TIMEOUT_MS = 30_000;
const INDEXING_LAG_BUFFER_MS = 5_000;

interface RenderLogLabel {
	name: string;
	value: string;
}

interface RenderLogEntry {
	timestamp: string;
	message: string;
	labels?: RenderLogLabel[];
}

interface RenderLogsResponse {
	logs?: RenderLogEntry[];
	hasMore?: boolean;
	nextStartTime?: string;
	nextEndTime?: string;
}

type LokiLabels = Record<string, string>;

interface LokiStream {
	stream: LokiLabels;
	values: [string, string][];
}

interface LokiPayload {
	streams: LokiStream[];
}

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		console.error(`Missing required env var: ${key}`);
		process.exit(1);
	}
	return value;
}

const RENDER_API_KEY = requireEnv("RENDER_API_KEY");
const RENDER_OWNER_ID = requireEnv("RENDER_OWNER_ID");
const RENDER_RESOURCE_IDS = requireEnv("RENDER_RESOURCE_IDS");
const LOKI_PUSH_URL = requireEnv("LOKI_PUSH_URL");
const LOKI_USERNAME = requireEnv("LOKI_USERNAME");
const LOKI_PASSWORD = requireEnv("LOKI_PASSWORD");

let lokiUrl: URL;
try {
	lokiUrl = new URL(LOKI_PUSH_URL);
} catch {
	console.error("LOKI_PUSH_URL must be a valid URL");
	process.exit(1);
}

if (
	lokiUrl.protocol !== "https:" ||
	!lokiUrl.hostname.endsWith(".stackit.cloud")
) {
	console.error("LOKI_PUSH_URL must be an HTTPS endpoint on stackit.cloud");
	process.exit(1);
}

const resourceIds = RENDER_RESOURCE_IDS.split(",")
	.map((id) => id.trim())
	.filter(Boolean);

if (resourceIds.length === 0) {
	console.error(
		"RENDER_RESOURCE_IDS must contain at least one non-empty service ID",
	);
	process.exit(1);
}

const pollIntervalMs =
	(parseInt(process.env.POLL_INTERVAL_SECONDS ?? "", 10) || 60) * 1000;

const lokiAuth =
	"Basic " +
	Buffer.from(`${LOKI_USERNAME}:${LOKI_PASSWORD}`).toString("base64");

let lastPollTime = new Date(Date.now() - pollIntervalMs).toISOString();

function buildLogParams(startTime: string, endTime: string): URLSearchParams {
	const params = new URLSearchParams({
		ownerId: RENDER_OWNER_ID,
		startTime,
		endTime,
		direction: "forward",
		limit: LOGS_PER_PAGE,
	});
	for (const id of resourceIds) {
		params.append("resource", id);
	}
	return params;
}

async function fetchRenderLogs(
	startTime: string,
	endTime: string,
): Promise<RenderLogsResponse> {
	const response = await fetch(
		`${RENDER_LOGS_URL}?${buildLogParams(startTime, endTime)}`,
		{
			headers: { Authorization: `Bearer ${RENDER_API_KEY}` },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		},
	);

	if (response.status === 429) {
		console.warn("Rate limited by Render API, retrying next cycle");
		return { logs: [], hasMore: false };
	}

	if (!response.ok) {
		console.error(
			`Render API error (${startTime}–${endTime}): ${response.status} ${response.statusText}`,
		);
		return { logs: [], hasMore: false };
	}

	return (await response.json()) as RenderLogsResponse;
}

async function fetchAllLogs(endTime: string): Promise<RenderLogEntry[]> {
	const firstPage = await fetchRenderLogs(lastPollTime, endTime);
	const allLogs: RenderLogEntry[] = [...(firstPage.logs ?? [])];

	let { hasMore, nextStartTime, nextEndTime } = firstPage;

	for (
		let page = 0;
		hasMore && nextStartTime && nextEndTime && page < MAX_PAGES;
		page++
	) {
		const nextPage = await fetchRenderLogs(nextStartTime, nextEndTime);

		allLogs.push(...(nextPage.logs ?? []));
		hasMore = nextPage.hasMore;
		nextStartTime = nextPage.nextStartTime;
		nextEndTime = nextPage.nextEndTime;
	}

	if (hasMore) {
		console.warn(
			`Hit MAX_PAGES (${MAX_PAGES}), remaining logs deferred to next cycle`,
		);
	}

	return allLogs;
}

function toLokiPayload(logs: RenderLogEntry[]): LokiPayload {
	const streams = new Map<string, LokiStream>();

	for (const log of logs) {
		const labels: LokiLabels = { source: "render" };
		for (const label of log.labels ?? []) {
			labels[label.name] = label.value;
		}

		const key = JSON.stringify(labels, Object.keys(labels).sort());
		let stream = streams.get(key);
		if (!stream) {
			stream = { stream: labels, values: [] };
			streams.set(key, stream);
		}

		const timestampNanos =
			String(new Date(log.timestamp).getTime()) + NANOSECOND_SUFFIX;
		stream.values.push([timestampNanos, log.message]);
	}

	return { streams: Array.from(streams.values()) };
}

async function pushToLoki(logs: RenderLogEntry[]): Promise<void> {
	const response = await fetch(LOKI_PUSH_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: lokiAuth,
		},
		body: JSON.stringify(toLokiPayload(logs)),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Loki push failed: ${response.status} ${body}`);
	}

	console.log(`Pushed ${logs.length} log entries to Loki`);
}

function getLatestTimestamp(logs: RenderLogEntry[]): number {
	return logs.reduce(
		(max, log) => Math.max(max, new Date(log.timestamp).getTime()),
		0,
	);
}

function advanceCursor(targetMs: number): void {
	if (targetMs > Date.parse(lastPollTime)) {
		lastPollTime = new Date(targetMs).toISOString();
	}
}

async function poll(): Promise<void> {
	try {
		const endTime = new Date().toISOString();
		const logs = await fetchAllLogs(endTime);
		const safeCeilingMs = Date.parse(endTime) - INDEXING_LAG_BUFFER_MS;

		if (logs.length === 0) {
			advanceCursor(safeCeilingMs);
			return;
		}

		await pushToLoki(logs);

		const latestPlusOneMs = getLatestTimestamp(logs) + CURSOR_ADVANCE_MS;
		advanceCursor(Math.max(latestPlusOneMs, safeCeilingMs));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Poll cycle failed:", message);
	}
}

async function startPolling(): Promise<void> {
	await poll();
	setTimeout(startPolling, pollIntervalMs);
}

console.log(
	`Log shipper: polling every ${pollIntervalMs / 1000}s for ${resourceIds.length} services`,
);
startPolling();
