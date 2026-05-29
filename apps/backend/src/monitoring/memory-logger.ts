import * as Sentry from "@sentry/node";
import { config } from "../config";

const MB = 1024 * 1024;

let hasWarnedAboutFailure = false;

function sendMetricsToSentry(
	label: string,
	mem: NodeJS.MemoryUsage, // eslint-disable-line no-undef
): void {
	const sentryLabel = label.split(" (")[0];
	const attrs = { label: sentryLabel };
	Sentry.metrics.gauge("process.memory.rss_mb", Math.round(mem.rss / MB), {
		attributes: attrs,
	});
	Sentry.metrics.gauge(
		"process.memory.heap_used_mb",
		Math.round(mem.heapUsed / MB),
		{ attributes: attrs },
	);
	Sentry.metrics.gauge(
		"process.memory.heap_total_mb",
		Math.round(mem.heapTotal / MB),
		{ attributes: attrs },
	);
	Sentry.metrics.gauge(
		"process.memory.external_mb",
		Math.round(mem.external / MB),
		{ attributes: attrs },
	);
}

export function logMemory(label: string, requestId?: string): void {
	try {
		const mem = process.memoryUsage();

		if (config.featureFlagMemoryLog) {
			const prefix = requestId ? `[${requestId}]` : "";
			// eslint-disable-next-line no-console
			console.log(
				`[MEMORY] ${prefix} ${label} | rss=${Math.round(mem.rss / MB)}MB heap=${Math.round(mem.heapUsed / MB)}/${Math.round(mem.heapTotal / MB)}MB external=${Math.round(mem.external / MB)}MB`,
			);
		}

		sendMetricsToSentry(label, mem);
	} catch (err) {
		if (!hasWarnedAboutFailure) {
			console.error(
				"[MEMORY] logMemory failed, suppressing future warnings:",
				err,
			);
			hasWarnedAboutFailure = true;
		}
	}
}
