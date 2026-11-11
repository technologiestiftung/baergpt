import { tool } from "ai";
import { z } from "zod";
import path from "node:path";
import type { BaseContentDbService } from "../../services/db-service/base-db-service";
import { captureError } from "../../monitoring/capture-error";
import {
	INPUT_DIR,
	OUTPUT_DIR,
	WORKSPACE_DIR,
	ensureSandboxPod,
	execInSandbox,
	sandboxPodName,
	writeSandboxFile,
} from "./sandbox-pod";

const RUN_TIMEOUT_SECONDS = 120;
const MAX_OUTPUT_CHARS = 8_000;
const SCRIPT_PATH = "/tmp/run-script";
const RUN_MARKER_PATH = "/tmp/run-marker";

type CodeExecutionToolOptions = {
	dbService: BaseContentDbService;
	userId: string;
	sessionId: string;
	allowedDocumentIds: number[];
};

function truncate(text: string) {
	if (text.length <= MAX_OUTPUT_CHARS) {
		return text;
	}
	return `${text.slice(0, MAX_OUTPUT_CHARS)}\n… (output truncated)`;
}

function safeFileName(name: string) {
	return path.basename(name).replace(/[^\w.\-äöüÄÖÜß ]/g, "_");
}

type InputFile = { bucket: string; sourceUrl: string; name: string };

async function resolveInputFiles(options: CodeExecutionToolOptions) {
	const inputFiles: InputFile[] = [];
	for (const documentId of options.allowedDocumentIds) {
		try {
			const { bucket, sourceUrl, fileName } =
				await options.dbService.getStorageInformationForDocumentId(documentId);
			inputFiles.push({
				bucket,
				sourceUrl,
				name: safeFileName(fileName ?? sourceUrl),
			});
		} catch (error) {
			captureError(error);
		}
	}
	return inputFiles;
}

async function copyInputFilesIntoSandbox(
	podName: string,
	inputFiles: InputFile[],
	dbService: BaseContentDbService,
) {
	for (const { bucket, sourceUrl, name } of inputFiles) {
		try {
			const content = await dbService.downloadFileFromStorage(
				bucket,
				sourceUrl,
			);
			await writeSandboxFile(podName, `${INPUT_DIR}/${name}`, content);
		} catch (error) {
			captureError(error);
		}
	}
}

async function listNewOutputFiles(podName: string) {
	const listing = await execInSandbox(podName, [
		"find",
		OUTPUT_DIR,
		"-type",
		"f",
		"-newer",
		RUN_MARKER_PATH,
	]);
	return listing.stdout
		.toString("utf8")
		.split("\n")
		.filter(Boolean)
		.slice(0, 20);
}

export const codeExecutionTool = async (options: CodeExecutionToolOptions) => {
	const podName = sandboxPodName(options.userId, options.sessionId);
	const inputFiles = await resolveInputFiles(options);
	const inputFileList = inputFiles.length
		? inputFiles.map(({ name }) => `${INPUT_DIR}/${name}`).join("\n")
		: "(none)";

	return tool({
		description: `Run Python or bash code in a private Linux sandbox that belongs to this chat. Use it whenever the user wants files analysed, converted, edited or created (Excel/CSV analysis, charts, image editing, splitting/merging/filling PDFs, writing Word or Excel files), or for any calculation.

Rules:
- The sandbox has NO internet access. Do not try to download anything or pip install.
- Files the user attached to the chat, with their exact paths:
${inputFileList}
- Never end your turn by announcing a next step. Keep calling this tool until the requested result file exists, then answer.
- There is no direct PDF-to-Word converter. To turn a PDF into a Word file, extract the text with pdfplumber and write it with python-docx.
- Save every file the user should receive to ${OUTPUT_DIR}. The tool result lists the new files there.
- In your final answer, link each result file by its sandbox path, exactly like [report.docx](${OUTPUT_DIR}/report.docx). Show images (png, jpg) inline as ![description](${OUTPUT_DIR}/chart.png). The app turns these paths into downloads; never invent another URL.
- Files and variables do not survive between calls unless written to ${WORKSPACE_DIR}; each call is a fresh process.
- Each call may run for at most ${RUN_TIMEOUT_SECONDS} seconds. Print only what you need; long output is cut off.
- Installed: pandas, numpy, openpyxl, xlsxwriter, matplotlib, seaborn, scipy, Pillow, opencv, pypdf, pikepdf, reportlab, pdfplumber, python-docx, docxtpl, python-pptx, tesseract (deu+eng), qpdf, poppler-utils, imagemagick.
- If code fails, read the error, fix it and run again.`,
		inputSchema: z.object({
			language: z.enum(["python", "bash"]),
			code: z.string().describe("The complete script to run."),
		}),
		execute: async ({ language, code }) => {
			try {
				const isNewPod = await ensureSandboxPod(podName);
				if (isNewPod) {
					await copyInputFilesIntoSandbox(
						podName,
						inputFiles,
						options.dbService,
					);
				}

				await writeSandboxFile(podName, SCRIPT_PATH, code);
				await execInSandbox(podName, ["touch", RUN_MARKER_PATH]);

				const interpreter = language === "python" ? "python3" : "bash";
				const run = await execInSandbox(podName, [
					"timeout",
					"--signal=KILL",
					String(RUN_TIMEOUT_SECONDS),
					interpreter,
					SCRIPT_PATH,
				]);

				return {
					exitCode: run.exitCode,
					timedOut: run.exitCode === 137,
					stdout: truncate(run.stdout.toString("utf8")),
					stderr: truncate(run.stderr),
					files: await listNewOutputFiles(podName),
				};
			} catch (error) {
				captureError(error);
				return {
					exitCode: 1,
					stdout: "",
					stderr: "The sandbox is currently unavailable.",
					files: [],
				};
			}
		},
	});
};
