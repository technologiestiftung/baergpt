export interface InactivityConfig {
	inactivityMonths: number;
	warningDays: number;
	reminderDays: number;
	appUrl: string;
}

export interface InactiveUser {
	user_id: string;
	email: string | null;
	first_name: string | null;
	last_name: string | null;
	last_active_at: string;
	is_banned: boolean;
	notified_last_active_at: string | null;
	deletion_date: string | null;
	warning_sent_at: string | null;
	reminder_sent_at: string | null;
}

export type InactivityAction =
	| { type: "none" }
	| { type: "cancel" }
	| { type: "warn"; deletionDate: string }
	| { type: "remind"; deletionDate: string }
	| { type: "delete" };

export interface Email {
	subject: string;
	text: string;
	html: string;
}

interface EmailParams {
	user: InactiveUser;
	deletionDate: string;
	config: InactivityConfig;
	today: string;
	htmlTemplate: string;
}

const DEFAULT_INACTIVITY_MONTHS = 18;
const DEFAULT_WARNING_DAYS = 30;
const DEFAULT_REMINDER_DAYS = 7;
const DEFAULT_FRONTEND_APP_URL = "https://www.baergpt.berlin";

function parsePositiveInt(
	name: string,
	value: string | undefined,
	fallback: number,
): number {
	if (value === undefined || value === "") {
		return fallback;
	}
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer, got "${value}"`);
	}
	return parsed;
}

export function readInactivityConfig(
	env: Record<string, string | undefined>,
): InactivityConfig {
	const config = {
		inactivityMonths: parsePositiveInt(
			"INACTIVITY_DELETION_MONTHS",
			env.INACTIVITY_DELETION_MONTHS,
			DEFAULT_INACTIVITY_MONTHS,
		),
		warningDays: parsePositiveInt(
			"INACTIVITY_WARNING_DAYS",
			env.INACTIVITY_WARNING_DAYS,
			DEFAULT_WARNING_DAYS,
		),
		reminderDays: parsePositiveInt(
			"INACTIVITY_REMINDER_DAYS",
			env.INACTIVITY_REMINDER_DAYS,
			DEFAULT_REMINDER_DAYS,
		),
		appUrl: (env.FRONTEND_APP_URL || DEFAULT_FRONTEND_APP_URL).replace(
			/\/+$/,
			"",
		),
	};

	if (config.reminderDays >= config.warningDays) {
		throw new Error(
			"INACTIVITY_REMINDER_DAYS must be smaller than INACTIVITY_WARNING_DAYS",
		);
	}

	return config;
}

/**
 * All scheduling works on calendar dates (YYYY-MM-DD) in Berlin time, so the
 * deletion date in the email is the last day a login keeps the account.
 */
export function toBerlinDate(date: Date): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(
		date,
	);
}

export function addDays(date: string, days: number): string {
	const result = new Date(`${date}T00:00:00Z`);
	result.setUTCDate(result.getUTCDate() + days);
	return result.toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number): string {
	const [year, month, day] = date.split("-").map(Number);
	const result = new Date(Date.UTC(year, month - 1 + months, 1));
	const lastDayOfMonth = new Date(
		Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
	).getUTCDate();
	result.setUTCDate(Math.min(day, lastDayOfMonth));
	return result.toISOString().slice(0, 10);
}

function fullMonthsBetween(from: string, to: string): number {
	const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
	const [toYear, toMonth, toDay] = to.split("-").map(Number);
	const months = (toYear - fromYear) * 12 + (toMonth - fromMonth);
	return toDay < fromDay ? months - 1 : months;
}

/**
 * Lower bound for get_inactive_users: everyone who could be due for a warning
 * today, plus a week of slack for month-end clamping (up to 3 days) and time
 * zones. The exact decision is made by planInactivityAction.
 */
export function inactiveSinceCutoff(
	config: InactivityConfig,
	today: string,
): string {
	const cutoff = addDays(
		addMonths(addDays(today, config.warningDays), -config.inactivityMonths),
		7,
	);
	return `${cutoff}T00:00:00Z`;
}

export function planInactivityAction(
	user: InactiveUser,
	config: InactivityConfig,
	today: string,
): InactivityAction {
	if (
		user.warning_sent_at &&
		user.deletion_date &&
		user.notified_last_active_at
	) {
		const hasBeenActiveSinceWarning =
			new Date(user.last_active_at).getTime() !==
			new Date(user.notified_last_active_at).getTime();

		// A ban pauses the deletion, after the ban the user gets a new warning period
		if (hasBeenActiveSinceWarning || user.is_banned) {
			return { type: "cancel" };
		}
		// The emails promise a login is possible until the end of the deletion date
		if (today > user.deletion_date) {
			return { type: "delete" };
		}
		if (
			!user.reminder_sent_at &&
			today >= addDays(user.deletion_date, -config.reminderDays)
		) {
			return { type: "remind", deletionDate: user.deletion_date };
		}
		return { type: "none" };
	}

	const lastActiveDate = toBerlinDate(new Date(user.last_active_at));
	const regularDeletionDate = addMonths(
		lastActiveDate,
		config.inactivityMonths,
	);

	if (today < addDays(regularDeletionDate, -config.warningDays)) {
		return { type: "none" };
	}

	// Accounts that are already overdue (e.g. when this job first runs) still
	// get the full warning period before they are deleted.
	const earliestDeletionDate = addDays(today, config.warningDays);
	return {
		type: "warn",
		deletionDate:
			regularDeletionDate > earliestDeletionDate
				? regularDeletionDate
				: earliestDeletionDate,
	};
}

// Mailbox unavailable, user not local, mailbox name not allowed
const PERMANENT_RECIPIENT_CODES = [550, 551, 553];

// Other 5xx (e.g. a wrong SMTP login or sender) mean nobody was warned, so they must not count as sent
export function isRecipientRejectedPermanently(
	error: unknown,
	recipient: string,
): boolean {
	const { responseCode, rejected } = error as {
		responseCode?: number;
		rejected?: string[];
	};
	return (
		responseCode !== undefined &&
		PERMANENT_RECIPIENT_CODES.includes(responseCode) &&
		(rejected ?? []).some(
			(address) => address.toLowerCase() === recipient.toLowerCase(),
		)
	);
}

function formatGermanDate(date: string): string {
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${date}T00:00:00Z`));
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function renderTemplate(
	template: string,
	values: Record<string, string | number>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) => {
		if (!(key in values)) {
			throw new Error(`Missing value for template placeholder ${placeholder}`);
		}
		return escapeHtml(String(values[key]));
	});
}

function greeting(user: InactiveUser): string {
	const name = [user.first_name, user.last_name]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(" ");
	return name ? `Guten Tag ${name},` : "Guten Tag,";
}

export function buildWarningEmail({
	user,
	deletionDate,
	config,
	today,
	htmlTemplate,
}: EmailParams): Email {
	const date = formatGermanDate(deletionDate);
	const monthsInactive = fullMonthsBetween(
		toBerlinDate(new Date(user.last_active_at)),
		today,
	);

	return {
		subject: `Ihr BärGPT-Konto wird am ${date} gelöscht`,
		text: `${greeting(user)}

Sie haben sich seit über ${monthsInactive} Monaten nicht mehr bei BärGPT angemeldet. Aus Datenschutzgründen löschen wir Konten, die ${config.inactivityMonths} Monate lang nicht genutzt wurden.

Ihr Konto wird am ${date} dauerhaft gelöscht. Dabei werden alle zugehörigen Daten entfernt, einschließlich Chatverläufe, hochgeladene Dokumente und persönlichen Einstellungen. Die Löschung kann nicht rückgängig gemacht werden.

Sie möchten BärGPT weiter nutzen?
Melden Sie sich einfach bis zum ${date} an. Ihr Konto bleibt dann erhalten:
${config.appUrl}/login/

Sie benötigen BärGPT nicht mehr?
Dann müssen Sie nichts tun. Ihr Konto und Ihre Daten werden automatisch gelöscht.

Weitere Informationen finden Sie in unserer Datenschutzerklärung: ${config.appUrl}/privacy-policy/
Bei Fragen erreichen Sie uns unter support@baergpt.berlin.

Mit freundlichen Grüßen
Ihr BärGPT-Team
`,
		html: renderTemplate(htmlTemplate, {
			greeting: greeting(user),
			months_inactive: monthsInactive,
			inactivity_months: config.inactivityMonths,
			deletion_date: date,
			app_url: config.appUrl,
		}),
	};
}

export function buildReminderEmail({
	user,
	deletionDate,
	config,
	today,
	htmlTemplate,
}: EmailParams): Email {
	const date = formatGermanDate(deletionDate);
	const daysLeft = Math.round(
		(new Date(`${deletionDate}T00:00:00Z`).getTime() -
			new Date(`${today}T00:00:00Z`).getTime()) /
			(24 * 60 * 60 * 1000),
	);

	return {
		subject:
			daysLeft === 1
				? "Erinnerung: Ihr BärGPT-Konto wird morgen gelöscht"
				: `Erinnerung: Ihr BärGPT-Konto wird in ${daysLeft} Tagen gelöscht`,
		text: `${greeting(user)}

wir möchten Sie daran erinnern, dass Ihr BärGPT-Konto am ${date} wegen Inaktivität dauerhaft gelöscht wird. Alle Chatverläufe, Dokumente und Einstellungen werden dabei unwiderruflich entfernt.

Wenn Sie Ihr Konto behalten möchten, melden Sie sich bitte vorher an:
👉 ${config.appUrl}/login/

Andernfalls müssen Sie nichts tun.

Mit freundlichen Grüßen
Ihr BärGPT-Team
`,
		html: renderTemplate(htmlTemplate, {
			greeting: greeting(user),
			deletion_date: date,
			app_url: config.appUrl,
		}),
	};
}
