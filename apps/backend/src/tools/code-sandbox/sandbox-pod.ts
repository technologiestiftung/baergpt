import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { config } from "../../config";

const POD_READY_TIMEOUT_SECONDS = 90;
const POD_LIFETIME_SECONDS = 30 * 60;
const KUBECTL_TIMEOUT_MS = 150_000;
const SANDBOX_LABEL = "app=code-sandbox";

export const WORKSPACE_DIR = "/workspace";
export const INPUT_DIR = `${WORKSPACE_DIR}/input`;
export const OUTPUT_DIR = `${WORKSPACE_DIR}/output`;

type KubectlResult = { stdout: Buffer; stderr: string; exitCode: number };

function kubectl(args: string[], stdin?: Buffer | string) {
	const baseArgs = ["--namespace", config.codeSandboxNamespace];
	if (config.codeSandboxKubeContext) {
		baseArgs.push("--context", config.codeSandboxKubeContext);
	}

	return new Promise<KubectlResult>((resolve, reject) => {
		const child = spawn(config.codeSandboxKubectlPath, [...baseArgs, ...args], {
			timeout: KUBECTL_TIMEOUT_MS,
		});
		const stdoutChunks: Uint8Array[] = [];
		const stderrChunks: Uint8Array[] = [];

		child.stdout.on("data", (chunk: Uint8Array) => stdoutChunks.push(chunk));
		child.stderr.on("data", (chunk: Uint8Array) => stderrChunks.push(chunk));
		child.on("error", reject);
		child.on("close", (code) =>
			resolve({
				stdout: Buffer.concat(stdoutChunks),
				stderr: Buffer.concat(stderrChunks).toString("utf8"),
				exitCode: code ?? 1,
			}),
		);

		child.stdin.on("error", () => {});
		child.stdin.end(stdin);
	});
}

async function kubectlOrThrow(args: string[], stdin?: Buffer | string) {
	const result = await kubectl(args, stdin);
	if (result.exitCode !== 0) {
		throw new Error(`kubectl ${args[0]} failed: ${result.stderr.trim()}`);
	}
	return result;
}

// Hashing in the user id keeps one user from reaching another user's pod by guessing a chat id.
export function sandboxPodName(userId: string, sessionId: string) {
	const digest = createHash("sha256")
		.update(`${userId}:${sessionId}`)
		.digest("hex")
		.slice(0, 20);
	return `sbx-${digest}`;
}

function podManifest(podName: string) {
	return {
		apiVersion: "v1",
		kind: "Pod",
		metadata: { name: podName, labels: { app: "code-sandbox" } },
		spec: {
			restartPolicy: "Never",
			activeDeadlineSeconds: POD_LIFETIME_SECONDS,
			automountServiceAccountToken: false,
			enableServiceLinks: false,
			securityContext: {
				runAsNonRoot: true,
				runAsUser: 1000,
				runAsGroup: 1000,
				fsGroup: 1000,
				seccompProfile: { type: "RuntimeDefault" },
			},
			containers: [
				{
					name: "sandbox",
					image: config.codeSandboxImage,
					imagePullPolicy: "IfNotPresent",
					command: ["sleep", "infinity"],
					workingDir: WORKSPACE_DIR,
					securityContext: {
						allowPrivilegeEscalation: false,
						capabilities: { drop: ["ALL"] },
					},
					resources: {
						requests: { cpu: "250m", memory: "512Mi" },
						limits: { cpu: "2", memory: "2Gi" },
					},
					volumeMounts: [
						{ name: "workspace", mountPath: WORKSPACE_DIR },
						{ name: "tmp", mountPath: "/tmp" },
					],
				},
			],
			volumes: [
				{ name: "workspace", emptyDir: { sizeLimit: "1Gi" } },
				{ name: "tmp", emptyDir: { sizeLimit: "512Mi" } },
			],
		},
	};
}

/** Returns true when a fresh pod was created, so the caller knows to copy the input files in again. */
export async function ensureSandboxPod(podName: string): Promise<boolean> {
	const phase = await kubectl([
		"get",
		"pod",
		podName,
		"--output",
		"jsonpath={.status.phase}",
	]);
	if (phase.exitCode === 0 && phase.stdout.toString() === "Running") {
		return false;
	}

	// Pods that hit their lifetime stay behind as Failed until someone removes them.
	await kubectl([
		"delete",
		"pod",
		"--selector",
		SANDBOX_LABEL,
		"--field-selector",
		"status.phase!=Running,status.phase!=Pending",
		"--wait=true",
	]);

	await kubectlOrThrow(
		["apply", "--filename", "-"],
		JSON.stringify(podManifest(podName)),
	);
	await kubectlOrThrow([
		"wait",
		"--for=condition=Ready",
		`pod/${podName}`,
		`--timeout=${POD_READY_TIMEOUT_SECONDS}s`,
	]);
	await execInSandbox(podName, ["mkdir", "-p", INPUT_DIR, OUTPUT_DIR]);

	return true;
}

export async function execInSandbox(
	podName: string,
	command: string[],
	stdin?: Buffer | string,
) {
	const args = ["exec", podName, "--container", "sandbox"];
	if (stdin !== undefined) {
		args.push("--stdin");
	}
	return kubectl([...args, "--", ...command], stdin);
}

export async function writeSandboxFile(
	podName: string,
	path: string,
	content: Buffer | string,
) {
	const result = await execInSandbox(
		podName,
		["sh", "-c", 'cat > "$0"', path],
		content,
	);
	if (result.exitCode !== 0) {
		throw new Error(`Writing ${path} failed: ${result.stderr.trim()}`);
	}
}
