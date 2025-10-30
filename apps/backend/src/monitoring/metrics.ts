import { metrics, trace } from "@opentelemetry/api";

const meter = metrics.getMeter("baergpt-service", "1.0.0");
const tracer = trace.getTracer("baergpt-service", "1.0.0");

// Request duration histogram with custom buckets for detailed latency tracking
export const requestDuration = meter.createHistogram(
	"request_duration_seconds",
	{
		description: "Request duration in seconds",
		unit: "s",
	},
);

export async function recordDuration<T>(
	operationName: string,
	fn: () => Promise<T>,
): Promise<T> {
	const span = tracer.startSpan(operationName);
	const startTime = performance.now();

	try {
		const result = await fn();
		return result;
	} catch (error) {
		span.recordException(error as Error);
		throw error;
	} finally {
		const duration = (performance.now() - startTime) / 1000; // Convert to seconds
		requestDuration.record(duration, { operation: operationName });
		span.end();
	}
}
