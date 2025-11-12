import Bottleneck from "bottleneck";
import Redis from "ioredis";
import { config } from "../config";

type QueueType = "embeddings" | "llm";

interface QueueMetrics {
	queued: number;
	running: number;
	done: number;
	failed: number;
	dropped: number;
}

interface QueueStats {
	embeddings: QueueMetrics;
	llm: QueueMetrics;
}

let embeddingsLimiter: Bottleneck | undefined;
let llmLimiter: Bottleneck | undefined;
let readyPromise: Promise<void> | undefined;

// Metrics tracking
const metrics: QueueStats = {
	embeddings: {
		queued: 0,
		running: 0,
		done: 0,
		failed: 0,
		dropped: 0,
	},
	llm: {
		queued: 0,
		running: 0,
		done: 0,
		failed: 0,
		dropped: 0,
	},
};

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

function setupEventListeners(
	limiter: Bottleneck,
	queueType: QueueType,
): void {
	limiter.on("queued", () => {
		metrics[queueType].queued++;
		console.log(`[queue:${queueType}] Task queued`);
	});

	limiter.on("executing", () => {
		metrics[queueType].queued = Math.max(0, metrics[queueType].queued - 1);
		metrics[queueType].running++;
		console.log(`[queue:${queueType}] Task started executing`);
	});

	limiter.on("done", () => {
		metrics[queueType].running = Math.max(0, metrics[queueType].running - 1);
		metrics[queueType].done++;
		console.log(`[queue:${queueType}] Task completed`);
	});

	limiter.on("failed", () => {
		metrics[queueType].running = Math.max(0, metrics[queueType].running - 1);
		metrics[queueType].failed++;
		console.log(`[queue:${queueType}] Task failed`);
	});

	limiter.on("dropped", () => {
		metrics[queueType].queued = Math.max(0, metrics[queueType].queued - 1);
		metrics[queueType].dropped++;
		console.log(`[queue:${queueType}] Task dropped`);
	});
}

async function logPeriodicMetrics(): Promise<void> {
	if (!embeddingsLimiter || !llmLimiter) {
		return;
	}

	try {
		const [embeddingsCounts, llmCounts] = await Promise.all([
			embeddingsLimiter.counts(),
			llmLimiter.counts(),
		]);

		const [embeddingsReservoir, llmReservoir] = await Promise.all([
			embeddingsLimiter.currentReservoir(),
			llmLimiter.currentReservoir(),
		]);

		console.log("[queue:metrics] Queue Statistics:", {
			embeddings: {
				queued: embeddingsCounts.QUEUED,
				running: embeddingsCounts.RUNNING,
				done: metrics.embeddings.done,
				failed: metrics.embeddings.failed,
				dropped: metrics.embeddings.dropped,
				reservoir: {
					current: embeddingsReservoir,
					max: config.jinaMaxRPS,
				},
			},
			llm: {
				queued: llmCounts.QUEUED,
				running: llmCounts.RUNNING,
				done: metrics.llm.done,
				failed: metrics.llm.failed,
				dropped: metrics.llm.dropped,
				reservoir: {
					current: llmReservoir,
					max: config.mistralMaxRPS,
				},
			},
		});
	} catch (error) {
		console.error("[queue:metrics] Failed to fetch queue metrics:", error);
	}
}

function ensureInitialized(): void {
	if (embeddingsLimiter && llmLimiter) {
		return;
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
		maxConcurrent: config.jinaMaxRPS,
	});

	llmLimiter = new Bottleneck({
		id: "baergpt:llm",
		datastore: "ioredis",
		Redis,
		clientOptions,
		reservoir: config.mistralMaxRPS,
		reservoirRefreshAmount: config.mistralMaxRPS,
		reservoirRefreshInterval: 1000,
		maxConcurrent: config.mistralMaxRPS,
	});

	// Set up event listeners for metrics tracking
	setupEventListeners(embeddingsLimiter, "embeddings");
	setupEventListeners(llmLimiter, "llm");

	// Start periodic metrics logging (every 30 seconds)
	setInterval(() => {
		void logPeriodicMetrics();
	}, 30000);

	// Ensure scripts are loaded and clients are ready before any schedule() calls.
	readyPromise = Promise.all([
		embeddingsLimiter.ready(),
		llmLimiter.ready(),
	]).then(() => {
		console.log("[queue] Queue system initialized and ready");
		// Log initial metrics after initialization
		void logPeriodicMetrics();
	});
}

export function scheduleDistributed<T>(
	queueType: QueueType,
	task: () => Promise<T>,
): Promise<T> {
	ensureInitialized();

	if (readyPromise) {
		return readyPromise.then(() => {
			if (queueType === "embeddings" && embeddingsLimiter) {
				return embeddingsLimiter.schedule(task);
			}
			if (queueType === "llm" && llmLimiter) {
				return llmLimiter.schedule(task);
			}
			throw new Error(`Distributed limiter for "${queueType}" not initialized.`);
		});
	}

	if (queueType === "embeddings" && embeddingsLimiter) {
		return embeddingsLimiter.schedule(task);
	}
	if (queueType === "llm" && llmLimiter) {
		return llmLimiter.schedule(task);
	}
	throw new Error(`Distributed limiter for "${queueType}" not initialized.`);
}
