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

const REQUIRED_ENV = [
	"RENDER_API_KEY",
	"RENDER_OWNER_ID",
	"RENDER_RESOURCE_IDS",
	"LOKI_PUSH_URL",
	"LOKI_USERNAME",
	"LOKI_PASSWORD",
];

for (const key of REQUIRED_ENV) {
	if (!process.env[key]) {
		console.error(`Missing required env var: ${key}`);
		process.exit(1);
	}
}

const {
	RENDER_API_KEY,
	RENDER_OWNER_ID,
	RENDER_RESOURCE_IDS,
	LOKI_PUSH_URL,
	LOKI_USERNAME,
	LOKI_PASSWORD,
} = process.env;

let lokiUrl;
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
	.filter(Boolean); // remove empty strings

if (resourceIds.length === 0) {
	console.error(
		"RENDER_RESOURCE_IDS must contain at least one non-empty service ID",
	);
	process.exit(1);
}

const pollIntervalMs =
	(parseInt(process.env.POLL_INTERVAL_SECONDS, 10) || 60) * 1000;

const lokiAuth =
	"Basic " +
	Buffer.from(`${LOKI_USERNAME}:${LOKI_PASSWORD}`).toString("base64");

let lastPollTime = new Date(Date.now() - pollIntervalMs).toISOString();

function buildLogParams(startTime, endTime) {
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

async function fetchRenderLogs(startTime, endTime) {
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

	return await response.json();
}

async function fetchAllLogs() {
	const firstPage = await fetchRenderLogs(
		lastPollTime,
		new Date().toISOString(),
	);
	const allLogs = [...(firstPage.logs || [])];

	let { hasMore, nextStartTime, nextEndTime } = firstPage;

	for (let page = 0; hasMore && page < MAX_PAGES; page++) {
		const nextPage = await fetchRenderLogs(nextStartTime, nextEndTime);

		allLogs.push(...(nextPage.logs || []));
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

function toLokiPayload(logs) {
	const streams = new Map();

	for (const log of logs) {
		const labels = { source: "render" };
		for (const label of log.labels || []) {
			labels[label.name] = label.value;
		}

		const key = JSON.stringify(labels, Object.keys(labels).sort());
		if (!streams.has(key)) {
			streams.set(key, { stream: labels, values: [] });
		}

		const timestampNanos =
			String(new Date(log.timestamp).getTime()) + NANOSECOND_SUFFIX;
		streams.get(key).values.push([timestampNanos, log.message]);
	}

	return { streams: Array.from(streams.values()) };
}

async function pushToLoki(logs) {
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

function getLatestTimestamp(logs) {
	return logs.reduce(
		(max, log) => Math.max(max, new Date(log.timestamp).getTime()),
		0,
	);
}

async function poll() {
	try {
		const logs = await fetchAllLogs();
		if (logs.length === 0) return;

		await pushToLoki(logs);

		lastPollTime = new Date(
			getLatestTimestamp(logs) + CURSOR_ADVANCE_MS,
		).toISOString();
	} catch (error) {
		console.error("Poll cycle failed:", error.message);
	}
}

async function startPolling() {
	await poll();
	setTimeout(startPolling, pollIntervalMs);
}

console.log(
	`Log shipper: polling every ${pollIntervalMs / 1000}s for ${resourceIds.length} services`,
);
startPolling();
