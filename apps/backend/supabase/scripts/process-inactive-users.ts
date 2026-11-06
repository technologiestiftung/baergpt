/* eslint-disable no-console */
/**
 * Warns, reminds and finally deletes accounts without a login for
 * INACTIVITY_DELETION_MONTHS. Runs daily via .github/workflows/process-inactive-users.yml.
 *
 * Logs contain only counts and SMTP status codes, never user ids, names or addresses.
 *
 * Run: npm run auth:assess-inactive-users (dry run) or npm run auth:process-inactive-users
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import nodemailer from "nodemailer";
import { serviceRoleDbClient as supabase } from "../../src/supabase";
import { config } from "../../src/config";
import { PrivilegedDbService } from "../../src/services/db-service/privileged-db-service";
import {
	buildReminderEmail,
	buildWarningEmail,
	inactiveSinceCutoff,
	isRecipientRejectedPermanently,
	planInactivityAction,
	readInactivityConfig,
	toBerlinDate,
	type Email,
	type InactivityAction,
	type InactiveUser,
} from "../../src/services/inactive-user-service";

const PAGE_SIZE = 1000;
const TEMPLATES_DIR = resolve(process.cwd(), "./supabase/templates");
const warningTemplate = readFileSync(
	join(TEMPLATES_DIR, "inactivity_warning.html"),
	"utf8",
);
const reminderTemplate = readFileSync(
	join(TEMPLATES_DIR, "inactivity_reminder.html"),
	"utf8",
);

type SendResult = "sent" | "undeliverable" | "failed";

const isDryRun = process.argv.includes("--dry-run");
const inactivityConfig = readInactivityConfig(process.env);
const today = toBerlinDate(new Date());
const privilegedDbService = new PrivilegedDbService(supabase);

function createTransport() {
	const {
		SMTP_HOST,
		SMTP_PORT,
		SMTP_USER,
		SMTP_PASS,
		SMTP_ADMIN_EMAIL,
		SMTP_SENDER_NAME,
	} = process.env;
	if (!SMTP_HOST || !SMTP_PORT || !SMTP_ADMIN_EMAIL) {
		console.error("Missing SMTP_HOST, SMTP_PORT or SMTP_ADMIN_EMAIL.");
		process.exit(1);
	}
	const port = Number(SMTP_PORT);
	return {
		sender: { name: SMTP_SENDER_NAME ?? "", address: SMTP_ADMIN_EMAIL },
		transport: nodemailer.createTransport({
			host: SMTP_HOST,
			port,
			secure: port === 465,
			// Mailpit (local dev) has no SMTP login
			auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
		}),
	};
}

async function fetchInactiveUsers(): Promise<InactiveUser[]> {
	const users: InactiveUser[] = [];
	const inactiveSince = inactiveSinceCutoff(inactivityConfig, today);

	for (let from = 0; ; from += PAGE_SIZE) {
		const { data, error } = await supabase
			.rpc("get_inactive_users", { inactive_since: inactiveSince })
			.range(from, from + PAGE_SIZE - 1);

		if (error) {
			throw new Error(`Failed to fetch inactive users: ${error.message}`);
		}

		users.push(...(data as InactiveUser[]));

		if (data.length < PAGE_SIZE) {
			return users;
		}
	}
}

type Mailer = ReturnType<typeof createTransport>;

async function sendEmail(
	mailer: Mailer,
	user: InactiveUser,
	email: Email,
): Promise<SendResult> {
	if (!user.email) {
		console.warn("Email not sent: account has no email address.");
		return "undeliverable";
	}
	try {
		await mailer.transport.sendMail({
			from: mailer.sender,
			to: user.email,
			subject: email.subject,
			text: email.text,
			html: email.html,
		});
		return "sent";
	} catch (error) {
		// The error message may contain the recipient address, so only the code is logged
		const { responseCode, code } = error as {
			responseCode?: number;
			code?: string;
		};
		if (isRecipientRejectedPermanently(error, user.email)) {
			console.warn(
				`Email rejected permanently (SMTP ${responseCode}). Deletion stays scheduled.`,
			);
			return "undeliverable";
		}
		console.error(
			`Email not sent (${responseCode ?? code ?? "unknown error"}), retrying on the next run.`,
		);
		return "failed";
	}
}

async function cancelDeletion(user: InactiveUser): Promise<boolean> {
	const { error } = await supabase
		.from("inactivity_notifications")
		.delete()
		.eq("user_id", user.user_id);
	if (error) {
		throw error;
	}
	return true;
}

async function sendWarning(
	mailer: Mailer,
	user: InactiveUser,
	deletionDate: string,
): Promise<boolean> {
	const email = buildWarningEmail({
		user,
		deletionDate,
		config: inactivityConfig,
		today,
		htmlTemplate: warningTemplate,
	});
	if ((await sendEmail(mailer, user, email)) === "failed") {
		return false;
	}
	const { error } = await supabase.from("inactivity_notifications").upsert({
		user_id: user.user_id,
		last_active_at: user.last_active_at,
		deletion_date: deletionDate,
		warning_sent_at: new Date().toISOString(),
	});
	if (error) {
		throw error;
	}
	return true;
}

async function sendReminder(
	mailer: Mailer,
	user: InactiveUser,
	deletionDate: string,
): Promise<boolean> {
	const email = buildReminderEmail({
		user,
		deletionDate,
		config: inactivityConfig,
		today,
		htmlTemplate: reminderTemplate,
	});
	if ((await sendEmail(mailer, user, email)) === "failed") {
		return false;
	}
	const { error } = await supabase
		.from("inactivity_notifications")
		.update({ reminder_sent_at: new Date().toISOString() })
		.eq("user_id", user.user_id);
	if (error) {
		throw error;
	}
	return true;
}

async function deleteInactiveUser(user: InactiveUser): Promise<boolean> {
	if (!user.deletion_date) {
		throw new Error("Planned a deletion without a deletion date.");
	}
	const deleted = await privilegedDbService.deleteInactiveUser(user.user_id, {
		lastActiveAt: user.last_active_at,
		deletionDate: user.deletion_date,
	});
	if (!deleted) {
		console.log("Skipped a deletion: the account changed during this run.");
	}
	return true;
}

function applyAction(
	mailer: Mailer,
	user: InactiveUser,
	action: InactivityAction,
): Promise<boolean> {
	switch (action.type) {
		case "cancel":
			return cancelDeletion(user);
		case "warn":
			return sendWarning(mailer, user, action.deletionDate);
		case "remind":
			return sendReminder(mailer, user, action.deletionDate);
		case "delete":
			return deleteInactiveUser(user);
		default:
			return Promise.resolve(true);
	}
}

async function run() {
	console.log(`Target Supabase instance: ${config.supabaseUrl}`);
	console.log(
		`Today (Europe/Berlin): ${today}, inactivity period: ${inactivityConfig.inactivityMonths} months, ` +
			`warning ${inactivityConfig.warningDays} days and reminder ${inactivityConfig.reminderDays} days before deletion.`,
	);
	if (isDryRun) {
		console.log(
			"Running in dry-run mode. No emails are sent and nothing is changed.",
		);
	}

	const users = await fetchInactiveUsers();
	const planned = users.map((user) => ({
		user,
		action: planInactivityAction(user, inactivityConfig, today),
	}));

	const counts = { cancel: 0, warn: 0, remind: 0, delete: 0, none: 0 };
	for (const { action } of planned) {
		counts[action.type] += 1;
	}
	console.log(
		`Planned: ${counts.warn} warning(s), ${counts.remind} reminder(s), ` +
			`${counts.delete} deletion(s), ${counts.cancel} cancellation(s) after a login.`,
	);

	if (isDryRun) {
		return;
	}

	const mailer = createTransport();
	let failures = 0;

	for (const { user, action } of planned) {
		try {
			if (!(await applyAction(mailer, user, action))) {
				failures += 1;
			}
		} catch (error) {
			const name = error instanceof Error ? error.name : "unknown error";
			console.error(`Failed to ${action.type} an inactive account (${name}).`);
			failures += 1;
		}
	}

	mailer.transport.close();
	console.log(`Done. ${failures} failure(s).`);
	if (failures > 0) {
		process.exit(1);
	}
}

run().catch((error) => {
	console.error("Processing inactive users failed:", error);
	process.exit(1);
});
