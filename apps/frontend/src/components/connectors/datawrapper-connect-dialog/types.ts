export type DialogMode = "connect" | "replace";

export type DialogError =
	| { type: "invalid" }
	| { type: "missing_scopes"; requiredScopes: string[] }
	| { type: "generic" };
