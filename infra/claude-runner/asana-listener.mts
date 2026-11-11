// Polls one or more Asana projects for "@claude" in task comments and descriptions, starts
// .github/workflows/claude-asana.yml for each, and posts Claude's reply back as a comment.
// Runs as a LaunchAgent (see install.sh). Node >= 24, no dependencies.
//
// Secrets stay on this Mac (keychain): the Asana token never reaches GitHub or Claude.

import { execFile } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, createSign, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const env = (name: string, fallback?: string): string => {
	const value = process.env[name] ?? fallback;
	if (!value) throw new Error(`Missing ${name} (set it in config.sh)`);
	return value;
};

const REPO = env("REPO");
const ORG = env("ORG");
const GITHUB_APP_ID = env("GITHUB_APP_ID");
const APP_KEY_SERVICE = env("KEYCHAIN_SERVICE");
const PROJECT_GIDS = env("ASANA_PROJECT_GIDS").split(",").map((gid) => gid.trim()).filter(Boolean);
const ASANA_TOKEN_SERVICE = env("ASANA_KEYCHAIN_SERVICE", "baergpt-asana-token");
const CONTEXT_KEY_SERVICE = env("ASANA_CONTEXT_KEY_SERVICE", "baergpt-asana-context-key");
const WORKFLOW = env("ASANA_WORKFLOW", "claude-asana.yml");
const WORKFLOW_REF = env("ASANA_WORKFLOW_REF", "main");
const POLL_SECONDS = Number(env("ASANA_POLL_SECONDS", "10"));
// Only these Asana users can trigger Claude. Board membership alone is not trusted.
const ALLOWED_USERS = new Set(env("ASANA_ALLOWED_USERS").split(",").map((gid) => gid.trim()).filter(Boolean));

const TRIGGER = /@claude\b/i;
const BOT_PREFIX = "🤖";
const MAX_CONTEXT_BYTES = 45_000; // UTF-8 bytes; +28 B crypto header, base64 grows ~33%; inputs are capped at 65,535 chars
const STATE_FILE = join(homedir(), ".config/baergpt-runner/asana-state.json");

type State = { sync: Record<string, string>; handled: string[] }; // sync token per project

const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function keychain(service: string): Promise<string> {
	const { stdout } = await run("security", ["find-generic-password", "-s", service, "-w"]);
	return stdout.trim();
}

// ---------- encryption ----------
// Run logs and artifacts of the public repo are public. Task and reply travel as
// base64(iv[12] | tag[16] | AES-256-GCM ciphertext); claude-asana.yml uses the same format.

const contextKey = async () => Buffer.from(await keychain(CONTEXT_KEY_SERVICE), "base64");

function encrypt(key: Buffer, text: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

function decrypt(key: Buffer, b64: string): string {
	const raw = Buffer.from(b64, "base64");
	const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
	decipher.setAuthTag(raw.subarray(12, 28));
	return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

// ---------- state ----------

async function loadState(): Promise<State> {
	try {
		const state = JSON.parse(await readFile(STATE_FILE, "utf8"));
		if (typeof state.sync !== "object" || state.sync === null) state.sync = {}; // pre multi-project state
		return state;
	} catch {
		return { sync: {}, handled: [] };
	}
}

async function saveState(state: State): Promise<void> {
	state.handled = state.handled.slice(-2000);
	await mkdir(join(homedir(), ".config/baergpt-runner"), { recursive: true });
	await writeFile(STATE_FILE, JSON.stringify(state));
}

// ---------- Asana ----------

async function asana(path: string, init: RequestInit = {}): Promise<Response> {
	const token = await keychain(ASANA_TOKEN_SERVICE);
	return fetch(`https://app.asana.com/api/1.0${path}`, {
		...init,
		headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
	});
}

async function asanaJson<T>(path: string): Promise<T> {
	const res = await asana(path);
	if (!res.ok) throw new Error(`Asana ${path}: ${res.status} ${await res.text()}`);
	return ((await res.json()) as { data: T }).data;
}

async function comment(taskGid: string, text: string): Promise<void> {
	const res = await asana(`/tasks/${taskGid}/stories`, {
		method: "POST",
		body: JSON.stringify({ data: { text: `${BOT_PREFIX} ${text}` } }),
	});
	if (!res.ok) throw new Error(`Asana comment: ${res.status} ${await res.text()}`);
}

type AsanaEvent = {
	action: string;
	resource: { gid: string; resource_type: string; resource_subtype?: string };
	parent?: { gid: string; resource_type: string } | null;
	change?: { field?: string } | null;
	user?: { gid: string } | null;
};

// undefined if the user may trigger Claude, else the user's GID (or "unknown").
function denied(userGid: string | undefined): string | undefined {
	return userGid && ALLOWED_USERS.has(userGid) ? undefined : (userGid ?? "unknown");
}

// Returns new events since the last sync token. A missing or expired token yields a fresh
// one and no events, so the listener only reacts to mentions written after it started.
async function pollEvents(state: State, project: string): Promise<AsanaEvent[]> {
	const events: AsanaEvent[] = [];
	for (;;) {
		const query = new URLSearchParams({ resource: project });
		if (state.sync[project]) query.set("sync", state.sync[project]);
		const res = await asana(`/events?${query}`);
		const body = (await res.json()) as { data?: AsanaEvent[]; sync: string; has_more?: boolean };
		if (res.status === 412) {
			state.sync[project] = body.sync;
			log(`Asana sync token (re)initialized for project ${project}`);
			return [];
		}
		// Keep the old token on other errors, so the next poll retries the same events.
		if (!res.ok) throw new Error(`Asana events (project ${project}): ${res.status} ${JSON.stringify(body)}`);
		state.sync[project] = body.sync;
		events.push(...(body.data ?? []));
		if (!body.has_more) return events;
	}
}

// Events of all projects. A failing project is skipped this round; the others still run.
async function pollAllEvents(state: State): Promise<AsanaEvent[]> {
	const events: AsanaEvent[] = [];
	for (const project of PROJECT_GIDS) {
		try {
			events.push(...(await pollEvents(state, project)));
		} catch (error) {
			log("Poll failed:", error);
		}
	}
	return events;
}

type Trigger = { key: string; taskGid: string; request: string; deniedUser?: string };

async function findTriggers(events: AsanaEvent[], state: State): Promise<Trigger[]> {
	const triggers: Trigger[] = [];
	const seen = new Set<string>();

	for (const event of events) {
		const { resource, parent } = event;

		if (resource.resource_type === "story" && event.action === "added" && parent?.resource_type === "task") {
			const story = await asanaJson<{ text: string; resource_subtype: string; created_by?: { gid: string } | null }>(
				`/stories/${resource.gid}?opt_fields=text,resource_subtype,created_by.gid`,
			);
			if (story.resource_subtype !== "comment_added") continue;
			if (story.text.startsWith(BOT_PREFIX) || !TRIGGER.test(story.text)) continue;
			triggers.push({
				key: `story:${resource.gid}`,
				taskGid: parent.gid,
				request: story.text,
				deniedUser: denied(story.created_by?.gid),
			});
		}

		const notesChanged =
			resource.resource_type === "task" &&
			(event.action === "added" || (event.action === "changed" && event.change?.field === "notes"));
		if (notesChanged && !seen.has(resource.gid)) {
			seen.add(resource.gid);
			const task = await asanaJson<{ notes: string }>(`/tasks/${resource.gid}?opt_fields=notes`);
			if (!TRIGGER.test(task.notes)) continue;
			// Key on the description's content, so editing it again re-triggers but saving it unchanged does not.
			const hash = createHash("sha256").update(task.notes).digest("hex").slice(0, 16);
			triggers.push({
				key: `notes:${resource.gid}:${hash}`,
				taskGid: resource.gid,
				request: task.notes,
				// The event's user is whoever created the task or edited its description.
				deniedUser: denied(event.user?.gid),
			});
		}
	}
	// A task on several boards yields the same event once per board.
	const unique = new Map(triggers.map((t) => [t.key, t]));
	return [...unique.values()].filter((t) => !state.handled.includes(t.key));
}

async function buildContext(taskGid: string, request: string): Promise<{ markdown: string; url: string }> {
	const task = await asanaJson<{ name: string; notes: string; permalink_url: string }>(
		`/tasks/${taskGid}?opt_fields=name,notes,permalink_url`,
	);
	const stories = await asanaJson<{ text: string; resource_subtype: string; created_at: string; created_by?: { name: string } }[]>(
		`/tasks/${taskGid}/stories?opt_fields=text,resource_subtype,created_at,created_by.name`,
	);
	const comments = stories
		.filter((s) => s.resource_subtype === "comment_added")
		.map((s) => `- ${s.created_at.slice(0, 16)} ${s.created_by?.name ?? "?"}: ${s.text}`)
		.join("\n");

	let markdown = [
		`# Asana task: ${task.name}`,
		`URL: ${task.permalink_url}`,
		"",
		"## Description",
		task.notes || "(empty)",
		"",
		"## Comments (oldest first)",
		comments || "(none)",
		"",
		"## The request you are answering",
		request,
	].join("\n");
	const bytes = Buffer.from(markdown);
	if (bytes.length > MAX_CONTEXT_BYTES) {
		// Drop the oldest content. Cutting mid-character yields one U+FFFD at the start, which is fine.
		markdown = `(truncated, oldest content dropped)\n${bytes.subarray(-(MAX_CONTEXT_BYTES - 100)).toString("utf8")}`;
	}
	return { markdown, url: task.permalink_url };
}

// ---------- GitHub (as the runner App) ----------

const b64url = (data: Buffer | string) => (typeof data === "string" ? Buffer.from(data) : data).toString("base64url");

async function githubToken(): Promise<string> {
	const key = Buffer.from(await keychain(APP_KEY_SERVICE), "base64").toString("utf8");
	const now = Math.floor(Date.now() / 1000);
	const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
		JSON.stringify({ iat: now - 60, exp: now + 540, iss: GITHUB_APP_ID }),
	)}`;
	const jwt = `${unsigned}.${b64url(createSign("RSA-SHA256").update(unsigned).sign(key))}`;
	const installation = (await (await gh(jwt, `/orgs/${ORG}/installation`)).json()) as { id: number };
	const res = await gh(jwt, `/app/installations/${installation.id}/access_tokens`, { method: "POST" });
	return ((await res.json()) as { token: string }).token;
}

async function gh(token: string, path: string, init: RequestInit = {}): Promise<Response> {
	const res = await fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			...init.headers,
		},
	});
	if (!res.ok) throw new Error(`GitHub ${path}: ${res.status} ${await res.text()}`);
	return res;
}

async function dispatchAndWait(context: string, taskUrl: string, onStarted: (url: string) => Promise<void>) {
	const requestId = randomUUID();
	let token = await githubToken();
	await gh(token, `/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
		method: "POST",
		body: JSON.stringify({
			ref: WORKFLOW_REF,
			inputs: { request_id: requestId, task_url: taskUrl, context_enc: encrypt(await contextKey(), context) },
		}),
	});

	type Run = { id: number; html_url: string; status: string; conclusion: string | null; display_title: string };
	let found: Run | undefined;
	const deadline = Date.now() + 75 * 60_000;
	let tokenAge = Date.now();
	while (Date.now() < deadline) {
		await sleep(15_000);
		if (Date.now() - tokenAge > 45 * 60_000) {
			token = await githubToken();
			tokenAge = Date.now();
		}
		if (!found) {
			const runs = (await (
				await gh(token, `/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=20`)
			).json()) as { workflow_runs: Run[] };
			found = runs.workflow_runs.find((r) => r.display_title.includes(requestId));
			if (found) await onStarted(found.html_url);
			continue;
		}
		const current = (await (await gh(token, `/repos/${REPO}/actions/runs/${found.id}`)).json()) as Run;
		if (current.status !== "completed") continue;
		return { run: current, reply: await downloadReply(token, current.id) };
	}
	throw new Error(found ? `Run timed out: ${found.html_url}` : "Run never started");
}

async function downloadReply(token: string, runId: number): Promise<string | undefined> {
	const { artifacts } = (await (await gh(token, `/repos/${REPO}/actions/runs/${runId}/artifacts`)).json()) as {
		artifacts: { name: string; archive_download_url: string }[];
	};
	const artifact = artifacts.find((a) => a.name === "asana-reply");
	if (!artifact) return undefined;
	const zip = Buffer.from(await (await gh(token, new URL(artifact.archive_download_url).pathname)).arrayBuffer());
	const dir = await mkdtemp(join(tmpdir(), "asana-reply-"));
	try {
		await writeFile(join(dir, "reply.zip"), zip);
		const { stdout } = await run("unzip", ["-p", join(dir, "reply.zip"), "reply.enc"]);
		return stdout.trim() ? decrypt(await contextKey(), stdout.trim()).trim() || undefined : undefined;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

// ---------- main loop ----------

async function handle(trigger: Trigger): Promise<void> {
	if (trigger.deniedUser) {
		log(`Denied ${trigger.key}: user ${trigger.deniedUser} is not in ASANA_ALLOWED_USERS`);
		await comment(
			trigger.taskGid,
			`Claude only answers allowlisted users. Ask the BärGPT dev team to add your Asana user ID ${trigger.deniedUser} to ASANA_ALLOWED_USERS.`,
		).catch((error) => log(`Failed to post denial for ${trigger.key}:`, error));
		return;
	}
	log(`Trigger ${trigger.key} on task ${trigger.taskGid}`);
	try {
		const { markdown, url } = await buildContext(trigger.taskGid, trigger.request);
		const { run: finished, reply } = await dispatchAndWait(markdown, url, (runUrl) =>
			comment(trigger.taskGid, `Claude is working on it: ${runUrl}`),
		);
		if (finished.conclusion === "success" && reply) {
			await comment(trigger.taskGid, reply);
		} else {
			await comment(trigger.taskGid, `Claude run ended with "${finished.conclusion}": ${finished.html_url}`);
		}
		log(`Done ${trigger.key}: ${finished.conclusion}`);
	} catch (error) {
		log(`Failed ${trigger.key}:`, error);
		await comment(trigger.taskGid, `Claude could not process this request (${(error as Error).message.slice(0, 200)}).`).catch(
			() => {},
		);
	}
}

const state = await loadState();
log(`Listening to Asana projects ${PROJECT_GIDS.join(", ")}, every ${POLL_SECONDS}s`);
for (;;) {
	try {
		const triggers = await findTriggers(await pollAllEvents(state), state);
		for (const trigger of triggers) {
			state.handled.push(trigger.key); // before starting, so a crash never runs it twice
			void handle(trigger);
		}
		await saveState(state);
	} catch (error) {
		log("Poll failed:", error);
	}
	await sleep(POLL_SECONDS * 1000);
}
