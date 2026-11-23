// Summarizes token usage and cost of a claude-code-action run from its execution file.
//
//   node claude-usage.mts summary <execution_file>
//     Prints e.g. "1m 23s · 412k tokens · ~$1.87 · claude-sonnet-5-5".
//
//   node claude-usage.mts annotate <execution_file>
//     Appends that summary to the header of Claude's tracking comment for this run
//     ("**Claude finished @x's task in 1m 23s**"). Needs GH_TOKEN, GITHUB_REPOSITORY, GITHUB_RUN_ID.
//
// Cost is Claude Code's own estimate at list prices, not the invoiced amount.

import { readFile } from "node:fs/promises";

type ResultMessage = {
	type: "result";
	duration_ms?: number;
	total_cost_usd?: number;
	usage?: Record<string, number>;
	modelUsage?: Record<string, unknown>;
};

async function readResult(file: string): Promise<ResultMessage | undefined> {
	const messages = JSON.parse(await readFile(file, "utf8")) as { type?: string }[];
	return messages.findLast((m) => m.type === "result") as ResultMessage | undefined;
}

function summarize(result: ResultMessage, withDuration = true): string {
	const parts: string[] = [];
	if (withDuration && result.duration_ms !== undefined) {
		const s = Math.round(result.duration_ms / 1000);
		parts.push(s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
	}
	const usage = result.usage ?? {};
	const tokens =
		(usage.input_tokens ?? 0) +
		(usage.output_tokens ?? 0) +
		(usage.cache_creation_input_tokens ?? 0) +
		(usage.cache_read_input_tokens ?? 0);
	parts.push(`${Math.round(tokens / 1000)}k tokens`);
	if (result.total_cost_usd !== undefined) parts.push(`~$${result.total_cost_usd.toFixed(2)}`);
	const models = Object.keys(result.modelUsage ?? {});
	if (models.length) parts.push(models.join(", "));
	return parts.join(" · ");
}

async function github(path: string, init: RequestInit = {}): Promise<unknown> {
	const res = await fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${process.env.GH_TOKEN}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			...init.headers,
		},
	});
	if (!res.ok) throw new Error(`GitHub ${path}: ${res.status} ${await res.text()}`);
	return res.json();
}

// The tracking comment links to this run ("[View job](.../actions/runs/<id>)"). It is an
// issue comment, or a review comment reply when triggered from a code review comment.
async function annotate(summary: string): Promise<void> {
	// summary has no duration here: the header already says "in 1m 23s".
	const repo = process.env.GITHUB_REPOSITORY;
	const runLink = `/actions/runs/${process.env.GITHUB_RUN_ID}`;
	const since = new Date(Date.now() - 3 * 3600_000).toISOString();
	const header = /(\*\*Claude (?:finished|encountered)[^*]*?)\*\*/;

	for (const kind of ["issues", "pulls"] as const) {
		const comments = (await github(
			`/repos/${repo}/${kind}/comments?since=${since}&sort=updated&direction=desc&per_page=100`,
		)) as { id: number; body: string }[];
		const comment = comments.find((c) => c.body.includes(runLink) && header.test(c.body));
		if (!comment) continue;
		if (comment.body.includes(" tokens")) return;
		await github(`/repos/${repo}/${kind}/comments/${comment.id}`, {
			method: "PATCH",
			body: JSON.stringify({ body: comment.body.replace(header, (_, head: string) => `${head} · ${summary}**`) }),
		});
		console.log(`Annotated ${kind} comment ${comment.id}: ${summary}`);
		return;
	}
	console.log(`No tracking comment found for this run; usage: ${summary}`);
}

const [mode, file] = process.argv.slice(2);
const result = file ? await readResult(file).catch(() => undefined) : undefined;
if (!result) {
	console.log("No result message in execution file");
	process.exit(0);
}
if (mode === "annotate") await annotate(summarize(result, false));
else console.log(summarize(result));
