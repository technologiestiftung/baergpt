/**
 * Render Log Shipper
 *
 * Polls Render's REST API for logs from specified services
 * and pushes them to STACKIT Observability's Loki endpoint.
 *
 * Environment variables:
 *   RENDER_API_KEY          - Render API key (Bearer token)
 *   RENDER_OWNER_ID         - Render workspace/owner ID
 *   RENDER_RESOURCE_IDS     - Comma-separated list of Render service IDs to collect logs from
 *   LOKI_PUSH_URL           - STACKIT Loki push endpoint (e.g. https://logs.stackitXX.argus.eu01.stackit.cloud/instances/.../loki/api/v1/push)
 *   LOKI_USERNAME           - STACKIT Observability username
 *   LOKI_PASSWORD           - STACKIT Observability password
 *   POLL_INTERVAL_SECONDS   - How often to poll (default: 60)
 */

const RENDER_API_BASE = "https://api.render.com/v1";

const requiredEnv = [
	"RENDER_API_KEY",
	"RENDER_OWNER_ID",
	"RENDER_RESOURCE_IDS",
	"LOKI_PUSH_URL",
	"LOKI_USERNAME",
	"LOKI_PASSWORD",
];

for (const key of requiredEnv) {
	if (!process.env[key]) {
		console.error(`Missing required environment variable: ${key}`);
		process.exit(1);
	}
}

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_OWNER_ID = process.env.RENDER_OWNER_ID;
const RESOURCE_IDS = process.env.RENDER_RESOURCE_IDS.split(",")
	.map((s) => s.trim())
	.filter(Boolean);
const LOKI_PUSH_URL = process.env.LOKI_PUSH_URL;
const lokiHost = new URL(LOKI_PUSH_URL).hostname;
if (!lokiHost.endsWith(".stackit.cloud")) {
	console.error(
		"LOKI_PUSH_URL must be an HTTPS endpoint on stackit.cloud",
	);
	process.exit(1);
}
const LOKI_USERNAME = process.env.LOKI_USERNAME;
const LOKI_PASSWORD = process.env.LOKI_PASSWORD;
const POLL_INTERVAL_MS =
	(parseInt(process.env.POLL_INTERVAL_SECONDS, 10) || 60) * 1000;

let lastPollTime = new Date(Date.now() - POLL_INTERVAL_MS).toISOString();

async function fetchLogs() {
	const params = new URLSearchParams();
	params.set("ownerId", RENDER_OWNER_ID);
	params.set("startTime", lastPollTime);
	params.set("endTime", new Date().toISOString());
	params.set("direction", "forward");
	params.set("limit", "100");

	for (const id of RESOURCE_IDS) {
		params.append("resource", id);
	}

	const url = `${RENDER_API_BASE}/logs?${params}`;
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${RENDER_API_KEY}` },
	});

	if (response.status === 429) {
		console.warn("Rate limited by Render API, will retry next cycle");
		return [];
	}

	if (!response.ok) {
		console.error(
			`Render API error: ${response.status} ${response.statusText}`,
		);
		return [];
	}

	const data = await response.json();
	const logs = data.logs || [];

	let allLogs = [...logs];
	let hasMore = data.hasMore;
	let nextStart = data.nextStartTime;
	let nextEnd = data.nextEndTime;

	const MAX_PAGES = 10;
	let page = 0;
	while (hasMore && page < MAX_PAGES) {
		page++;
		const pageParams = new URLSearchParams();
		pageParams.set("ownerId", RENDER_OWNER_ID);
		pageParams.set("startTime", nextStart);
		pageParams.set("endTime", nextEnd);
		pageParams.set("direction", "forward");
		pageParams.set("limit", "100");
		for (const id of RESOURCE_IDS) {
			pageParams.append("resource", id);
		}

		const pageResponse = await fetch(
			`${RENDER_API_BASE}/logs?${pageParams}`,
			{
				headers: { Authorization: `Bearer ${RENDER_API_KEY}` },
			},
		);

		if (!pageResponse.ok) {
			console.warn(
				`Pagination request failed: ${pageResponse.status}, stopping pagination`,
			);
			break;
		}

		const pageData = await pageResponse.json();
		allLogs = allLogs.concat(pageData.logs || []);
		hasMore = pageData.hasMore;
		nextStart = pageData.nextStartTime;
		nextEnd = pageData.nextEndTime;
	}

	if (hasMore) {
		console.warn(`Hit MAX_PAGES (${MAX_PAGES}), some logs may be deferred to next cycle`);
	}

	return allLogs;
}

function labelsFromLog(log) {
	const labels = { source: "render" };
	for (const label of log.labels || []) {
		labels[label.name] = label.value;
	}
	return labels;
}

function toLokiPayload(logs) {
	const streams = new Map();

	for (const log of logs) {
		const labels = labelsFromLog(log);
		const key = JSON.stringify(labels, Object.keys(labels).sort());

		if (!streams.has(key)) {
			streams.set(key, { stream: labels, values: [] });
		}

		// String concatenation avoids Number overflow (ms * 1e6 > MAX_SAFE_INTEGER)
		const tsNanos = String(new Date(log.timestamp).getTime()) + "000000";
		streams.get(key).values.push([tsNanos, log.message]);
	}

	return { streams: Array.from(streams.values()) };
}

async function pushToLoki(logs) {
	if (logs.length === 0) return;

	const payload = toLokiPayload(logs);
	const auth = Buffer.from(`${LOKI_USERNAME}:${LOKI_PASSWORD}`).toString(
		"base64",
	);

	const response = await fetch(LOKI_PUSH_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${auth}`,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Loki push failed: ${response.status} ${body}`);
	}

	console.log(`Pushed ${logs.length} log entries to Loki`);
}

async function poll() {
	try {
		const logs = await fetchLogs();
		if (logs.length === 0) return;

		await pushToLoki(logs);

		// Only advance cursor after successful push
		const latestTs = logs.reduce(
			(max, log) => Math.max(max, new Date(log.timestamp).getTime()),
			0,
		);
		lastPollTime = new Date(latestTs + 1).toISOString();
	} catch (err) {
		console.error("Poll cycle failed:", err.message);
	}
}

async function loop() {
	await poll();
	setTimeout(loop, POLL_INTERVAL_MS);
}

console.log(
	`Starting log shipper: polling every ${POLL_INTERVAL_MS / 1000}s for ${RESOURCE_IDS.length} services`,
);
loop();
