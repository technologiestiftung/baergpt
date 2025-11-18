import Bottleneck from "bottleneck";
import Redis from "ioredis";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";
type QueueType = "embeddings" | "llm";

let embeddingsLimiter: Bottleneck | undefined;
let llmLimiter: Bottleneck | undefined;
let readyPromise: Promise<void> | undefined;

function toClientOptions(url: string) {
	const u = new URL(url);
	return {
		host: u.hostname,
		port: u.port ? parseInt(u.port, 10) : 6379,
		password: u.password || undefined,
		username: u.username || undefined,
		tls: u.protocol === "rediss:" ? {} : undefined,
	};
}

export function initQueues(): Promise<void> {
	if (readyPromise) {
		return readyPromise;
	}

	if (embeddingsLimiter && llmLimiter) {
		return Promise.resolve();
	}

	if (!config.redisUrl) {
		throw new Error("REDIS_URL must be defined in environment.");
	}

	const clientOptions = toClientOptions(config.redisUrl);

	embeddingsLimiter = new Bottleneck({
		id: "baergpt:embeddings",
		datastore: "ioredis",
		Redis,
		clientOptions,
		reservoir: config.jinaMaxRPS,
		reservoirRefreshAmount: config.jinaMaxRPS,
		reservoirRefreshInterval: 1000,
		expiration: 600000,
		heartbeatInterval: 1000,
	});

	llmLimiter = new Bottleneck({
		id: "baergpt:llm",
		datastore: "ioredis",
		Redis,
		clientOptions,
		reservoir: config.mistralMaxRPS,
		reservoirRefreshAmount: config.mistralMaxRPS,
		reservoirRefreshInterval: 1000,
		expiration: 600000,
		heartbeatInterval: 1000,
	});

	llmLimiter.on("error", (error: Error) => {
		console.error(error);
		captureError(error);
	});

	embeddingsLimiter.on("error", (error: Error) => {
		console.error(error);
		captureError(error);
	});

	// Ensure scripts are loaded and clients are ready before any schedule() calls.
	readyPromise = Promise.all([
		embeddingsLimiter.ready(),
		llmLimiter.ready(),
	]).then(() => {
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

	if (queueType === "embeddings" && embeddingsLimiter) {
		return embeddingsLimiter.schedule(task);
	}
	if (queueType === "llm" && llmLimiter) {
		return llmLimiter.schedule(task);
	}
	throw new Error(`Distributed limiter for "${queueType}" not initialized.`);
}
