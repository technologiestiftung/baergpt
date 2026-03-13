import Bottleneck from "@sergiiivzhenko/bottleneck";
import Redis from "ioredis";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
type QueueType = "embeddings" | "llm" | "webSearch";

let mistralLimiter: Bottleneck | undefined;
let webSearchLimiter: Bottleneck | undefined;
let readyPromise: Promise<void> | undefined;

function toClientOptions(url: string) {
	const u = new URL(url);
	return {
		host: u.hostname,
		port: u.port ? parseInt(u.port, 10) : 6379,
		password: u.password || undefined,
		username: u.username || undefined,
		tls: u.protocol === "rediss:" ? {} : undefined,
		keepAlive: 30000, // Send keepalive packets every 30 seconds to prevent idle disconnects
		connectTimeout: 10000,
		retryStrategy: (times: number) => {
			if (times > 10) {
				console.error(
					"Redis connection failed after 10 retry attempts, giving up",
				);
				return null;
			}
			// Exponential backoff with max 3 second delay
			const delay = Math.min(times * 50, 3000);
			console.warn(
				`Redis connection retry attempt ${times}, waiting ${delay}ms`,
			);
			return delay;
		},
		reconnectOnError: (err: Error) => {
			// Automatically reconnect on specific errors
			// Return 1 to reconnect, 2 to reconnect and resend command, false to not reconnect
			const targetErrors = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"];
			if (targetErrors.some((target) => err.message.includes(target))) {
				console.warn(`Redis reconnecting due to: ${err.message}`);
				return 2;
			}
			return false;
		},
		maxRetriesPerRequest: 3,
		enableReadyCheck: true,
		enableOfflineQueue: true, // Queue commands when disconnected, execute when reconnected
		lazyConnect: false,
		connectionName: `baergpt-${config.nodeEnv || "unknown"}-${process.pid}`,
	};
}

export function initQueues(): Promise<void> {
	if (readyPromise) {
		return readyPromise;
	}

	if (mistralLimiter) {
		return Promise.resolve();
	}

	if (!config.redisUrl) {
		throw new Error("REDIS_URL must be defined in environment.");
	}

	const clientOptions = toClientOptions(config.redisUrl);

	mistralLimiter = new Bottleneck({
		id: "baergpt:mistral",
		datastore: "ioredis",
		Redis,
		clientOptions,
		reservoir: config.mistralMaxRPS,
		reservoirRefreshAmount: config.mistralMaxRPS,
		reservoirRefreshInterval: 1000,
		expiration: 600000,
		heartbeatInterval: 1000,
		clientTimeout: 480000, // Wait 8 minutes before deregistering unresponsive clients
	});

	mistralLimiter.on("error", (error: Error) => {
		console.error(`[Redis Mistral Limiter] Error: ${error.message}`);
		captureError(`Redis limiter failed: ${error.message}`);
	});

	const limiters = [mistralLimiter.ready()];

	if (
		config.featureFlagWebSearchAllowed &&
		config.braveSearchMaxRPS !== undefined
	) {
		webSearchLimiter = new Bottleneck({
			id: "baergpt:web-search",
			datastore: "ioredis",
			Redis,
			clientOptions,
			reservoir: config.braveSearchMaxRPS,
			reservoirRefreshAmount: config.braveSearchMaxRPS,
			reservoirRefreshInterval: 1000,
			expiration: 600000,
			heartbeatInterval: 1000,
			clientTimeout: 480000,
		});

		webSearchLimiter.on("error", (error: Error) => {
			console.error(`[Redis Web Search Limiter] Error: ${error.message}`);
			captureError(`Redis limiter failed: ${error.message}`);
		});

		limiters.push(webSearchLimiter.ready());
	}

	readyPromise = Promise.all(limiters).then(() => {
		/* eslint-disable-next-line no-console */
		console.info("Queue system initialized");
	});

	return readyPromise;
}

export async function scheduleDistributed<T>(
	queueType: QueueType,
	task: () => Promise<T>,
): Promise<T> {
	if (!readyPromise) {
		throw new Error("Queue system not initialized. Call initQueues() first.");
	}

	await readyPromise;

	if ((queueType === "embeddings" || queueType === "llm") && mistralLimiter) {
		return mistralLimiter.schedule(task);
	}
	if (queueType === "webSearch" && webSearchLimiter) {
		return webSearchLimiter.schedule(task);
	}
	throw new Error(`Distributed limiter for "${queueType}" not initialized.`);
}
