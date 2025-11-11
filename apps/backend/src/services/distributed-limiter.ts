import Bottleneck from "bottleneck";
import Redis from "ioredis";
import { config } from "../config";

type QueueType = "embeddings" | "llm";

let embeddingsLimiter: Bottleneck | undefined;
let llmLimiter: Bottleneck | undefined;
let readyPromise: Promise<void> | undefined;

function toClientOptions(url: string) {
	const u = new URL(url);
	const options = {
		host: u.hostname,
		port: u.port ? parseInt(u.port, 10) : 6379,
		password: u.password || undefined,
		username: u.username || undefined,
		tls: u.protocol === "rediss:" ? {} : undefined,
	};
	
	// Diagnostic logging
	const maskedUrl = url.replace(/:[^:@]+@/, ":****@"); // Mask password
	console.log("[queue:diagnostic] Parsed Redis URL:", {
		protocol: u.protocol,
		hostname: u.hostname,
		port: options.port,
		hasPassword: !!u.password,
		hasUsername: !!u.username,
		username: u.username || "(none)",
		usesTLS: u.protocol === "rediss:",
		maskedUrl,
	});
	
	return options;
}

function ensureInitialized(): void {
	if (embeddingsLimiter && llmLimiter) {
		console.log("[queue:diagnostic] Limiters already initialized, skipping");
		return;
	}
	
	console.log("[queue:diagnostic] Starting queue initialization...");
	
	if (!config.redisUrl) {
		console.error("[queue:diagnostic] ERROR: REDIS_URL is not defined");
		throw new Error(
			"REDIS_URL must be defined in environment.",
		);
	}

	const clientOptions = toClientOptions(config.redisUrl);

	// Log reservoir configuration values
	console.log("[queue:diagnostic] Reservoir configuration:", {
		jinaMaxRPS: config.jinaMaxRPS,
		mistralMaxRPS: config.mistralMaxRPS,
		jinaMaxRPSType: typeof config.jinaMaxRPS,
		mistralMaxRPSType: typeof config.mistralMaxRPS,
		jinaMaxRPSIsZero: config.jinaMaxRPS === 0,
		mistralMaxRPSIsZero: config.mistralMaxRPS === 0,
	});

	console.log("[queue:diagnostic] Creating embeddings limiter...");
	embeddingsLimiter = new Bottleneck({
		id: "baergpt:embeddings",
		datastore: "ioredis",
		Redis,
		clientOptions,
		reservoir: config.jinaMaxRPS,
		reservoirRefreshAmount: config.jinaMaxRPS,
		reservoirRefreshInterval: 1000,
		maxConcurrent: 1,
	});

	console.log("[queue:diagnostic] Creating LLM limiter...");
	llmLimiter = new Bottleneck({
		id: "baergpt:llm",
		datastore: "ioredis",
		Redis,
		clientOptions,
		reservoir: config.mistralMaxRPS,
		reservoirRefreshAmount: config.mistralMaxRPS,
		reservoirRefreshInterval: 1000,
		maxConcurrent: 1,
	});

	// Ensure scripts are loaded and clients are ready before any schedule() calls.
	console.log("[queue:diagnostic] Waiting for limiters to be ready...");
	const startTime = Date.now();
	
	readyPromise = Promise.all([
		embeddingsLimiter.ready().then(() => {
			const elapsed = Date.now() - startTime;
			console.log(`[queue:diagnostic] ✓ Embeddings limiter ready after ${elapsed}ms`);
		}).catch((error) => {
			const elapsed = Date.now() - startTime;
			console.error(`[queue:diagnostic] ✗ Embeddings limiter ready() failed after ${elapsed}ms:`, error);
			throw error;
		}),
		llmLimiter.ready().then(() => {
			const elapsed = Date.now() - startTime;
			console.log(`[queue:diagnostic] ✓ LLM limiter ready after ${elapsed}ms`);
		}).catch((error) => {
			const elapsed = Date.now() - startTime;
			console.error(`[queue:diagnostic] ✗ LLM limiter ready() failed after ${elapsed}ms:`, error);
			throw error;
		}),
	]).then(() => {
		const totalElapsed = Date.now() - startTime;
		console.log(`[queue:diagnostic] ✓ All limiters ready after ${totalElapsed}ms`);
	}).catch((error) => {
		const totalElapsed = Date.now() - startTime;
		console.error(`[queue:diagnostic] ✗ Limiter initialization failed after ${totalElapsed}ms:`, error);
		throw error;
	});
}

export function scheduleDistributed<T>(
	queueType: QueueType,
	task: () => Promise<T>,
): Promise<T> {
	const scheduleStartTime = Date.now();
	console.log(`[queue:diagnostic] scheduleDistributed called for queueType: "${queueType}"`);
	
	ensureInitialized();
	
	if (readyPromise) {
		console.log(`[queue:diagnostic] Waiting for readyPromise to resolve before scheduling "${queueType}" task...`);
		return readyPromise.then(() => {
			const waitElapsed = Date.now() - scheduleStartTime;
			console.log(`[queue:diagnostic] readyPromise resolved after ${waitElapsed}ms, scheduling "${queueType}" task`);
			
			if (queueType === "embeddings" && embeddingsLimiter) {
				return embeddingsLimiter.schedule(task).then((result) => {
					const totalElapsed = Date.now() - scheduleStartTime;
					console.log(`[queue:diagnostic] ✓ "${queueType}" task completed after ${totalElapsed}ms`);
					return result;
				}).catch((error) => {
					const totalElapsed = Date.now() - scheduleStartTime;
					console.error(`[queue:diagnostic] ✗ "${queueType}" task failed after ${totalElapsed}ms:`, error);
					throw error;
				});
			}
			if (queueType === "llm" && llmLimiter) {
				return llmLimiter.schedule(task).then((result) => {
					const totalElapsed = Date.now() - scheduleStartTime;
					console.log(`[queue:diagnostic] ✓ "${queueType}" task completed after ${totalElapsed}ms`);
					return result;
				}).catch((error) => {
					const totalElapsed = Date.now() - scheduleStartTime;
					console.error(`[queue:diagnostic] ✗ "${queueType}" task failed after ${totalElapsed}ms:`, error);
					throw error;
				});
			}
			throw new Error(`Distributed limiter for "${queueType}" not initialized.`);
		}).catch((error) => {
			const totalElapsed = Date.now() - scheduleStartTime;
			console.error(`[queue:diagnostic] ✗ readyPromise rejected after ${totalElapsed}ms, task not scheduled:`, error);
			throw error;
		});
	}

	console.log(`[queue:diagnostic] No readyPromise, scheduling "${queueType}" task directly`);
	if (queueType === "embeddings" && embeddingsLimiter) {
		return embeddingsLimiter.schedule(task);
	}
	if (queueType === "llm" && llmLimiter) {
		return llmLimiter.schedule(task);
	}
	throw new Error(`Distributed limiter for "${queueType}" not initialized.`);
}
