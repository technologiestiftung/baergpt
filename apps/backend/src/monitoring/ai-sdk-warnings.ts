import type { LogWarningsFunction } from "ai";

/**
 * GLM 5.3 models reject reasoning_effort "none", so @ai-sdk/mistral sends
 * "low" instead and logs a reasoning compatibility warning on every call with
 * extended thinking off. Same model IDs as the SDK's
 * modelsWithLowHighMaxReasoningEffort.
 */
const modelsWithIntendedReasoningMapping = new Set([
	"zai-glm-5-3",
	"zai-glm-5-3-flash",
]);

/**
 * The AI SDK logs every warning to the console by default. The intended
 * reasoning mapping for GLM 5.3 is dropped; all other warnings, including
 * reasoning warnings for other models, are still logged.
 */
const logAiSdkWarnings: LogWarningsFunction = ({
	warnings,
	provider,
	model,
}) => {
	const scope = provider && model ? ` (${provider} / ${model})` : "";
	const hasIntendedReasoningMapping =
		model !== undefined && modelsWithIntendedReasoningMapping.has(model);

	for (const warning of warnings) {
		const isIntendedReasoningMappingWarning =
			hasIntendedReasoningMapping &&
			warning.type === "compatibility" &&
			warning.feature === "reasoning";
		if (isIntendedReasoningMappingWarning) {
			continue;
		}

		console.warn(`AI SDK Warning${scope}:`, warning);
	}
};

export function configureAiSdkWarnings() {
	globalThis.AI_SDK_LOG_WARNINGS = logAiSdkWarnings;
}
