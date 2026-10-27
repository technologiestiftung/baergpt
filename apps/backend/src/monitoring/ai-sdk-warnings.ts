import type { LogWarningsFunction } from "ai";

/**
 * The AI SDK logs every warning to the console by default. With extended
 * thinking off, every GLM 5.3 call logs a reasoning compatibility warning
 * (it rejects "none", so the SDK sends "low" instead). That mapping is
 * intended, so those warnings are dropped; all other warnings are still logged.
 */
const logAiSdkWarnings: LogWarningsFunction = ({
	warnings,
	provider,
	model,
}) => {
	const scope = provider && model ? ` (${provider} / ${model})` : "";

	for (const warning of warnings) {
		const isReasoningCompatibilityWarning =
			warning.type === "compatibility" && warning.feature === "reasoning";
		if (isReasoningCompatibilityWarning) {
			continue;
		}

		/* eslint-disable-next-line no-console */
		console.warn(`AI SDK Warning${scope}:`, warning);
	}
};

export function configureAiSdkWarnings() {
	globalThis.AI_SDK_LOG_WARNINGS = logAiSdkWarnings;
}
