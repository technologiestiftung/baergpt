import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
	addDays,
	addMonths,
	buildReminderEmail,
	buildWarningEmail,
	inactiveSinceCutoff,
	planInactivityAction,
	readInactivityConfig,
	renderTemplate,
	type InactiveUser,
} from "./inactive-user-service";

const readTemplate = (name: string) =>
	readFileSync(resolve(process.cwd(), "supabase/templates", name), "utf8");
const warningTemplate = readTemplate("inactivity_warning.html");
const reminderTemplate = readTemplate("inactivity_reminder.html");

const config = readInactivityConfig({});

function inactiveUser(overrides: Partial<InactiveUser> = {}): InactiveUser {
	return {
		user_id: "00000000-0000-0000-0000-000000000001",
		email: "max@example.com",
		first_name: "Max",
		last_name: "Mustermann",
		last_active_at: "2025-03-10T09:00:00+00:00",
		is_banned: false,
		notified_last_active_at: null,
		deletion_date: null,
		warning_sent_at: null,
		reminder_sent_at: null,
		...overrides,
	};
}

function warnedUser(overrides: Partial<InactiveUser> = {}): InactiveUser {
	return inactiveUser({
		notified_last_active_at: "2025-03-10T09:00:00+00:00",
		deletion_date: "2026-09-10",
		warning_sent_at: "2026-08-11T03:00:00+00:00",
		...overrides,
	});
}

describe("readInactivityConfig", () => {
	it("defaults to 18 months with warnings 30 and 7 days before deletion", () => {
		expect(config).toEqual({
			inactivityMonths: 18,
			warningDays: 30,
			reminderDays: 7,
			appUrl: "https://www.baergpt.berlin",
		});
	});

	it("reads overrides from the environment", () => {
		expect(
			readInactivityConfig({
				INACTIVITY_DELETION_MONTHS: "12",
				INACTIVITY_WARNING_DAYS: "14",
				INACTIVITY_REMINDER_DAYS: "3",
				FRONTEND_APP_URL: "https://staging.example.com/",
			}),
		).toEqual({
			inactivityMonths: 12,
			warningDays: 14,
			reminderDays: 3,
			appUrl: "https://staging.example.com",
		});
	});

	it("rejects invalid values", () => {
		expect(() =>
			readInactivityConfig({ INACTIVITY_DELETION_MONTHS: "abc" }),
		).toThrow();
		expect(() =>
			readInactivityConfig({ INACTIVITY_REMINDER_DAYS: "30" }),
		).toThrow();
	});
});

describe("date helpers", () => {
	it("clamps to the end of shorter months", () => {
		expect(addMonths("2025-08-31", 18)).toBe("2027-02-28");
		expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
	});

	it("adds days across month and year boundaries", () => {
		expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
	});

	it("queries everyone who could be due for a warning", () => {
		const today = "2026-08-11";
		const cutoff = new Date(inactiveSinceCutoff(config, today));
		const dueUser = inactiveUser({
			last_active_at: "2025-03-10T20:00:00+00:00",
		});

		expect(planInactivityAction(dueUser, config, today).type).toBe("warn");
		expect(new Date(dueUser.last_active_at) < cutoff).toBe(true);
	});

	it("queries users whose deletion date is clamped to the end of a month", () => {
		const today = "2027-01-29";
		const dueUser = inactiveUser({
			last_active_at: "2025-08-31T12:00:00+00:00",
		});

		expect(planInactivityAction(dueUser, config, today)).toEqual({
			type: "warn",
			deletionDate: "2027-02-28",
		});
		expect(
			new Date(dueUser.last_active_at) <
				new Date(inactiveSinceCutoff(config, today)),
		).toBe(true);
	});
});

describe("planInactivityAction", () => {
	it("does nothing before the warning date", () => {
		expect(planInactivityAction(inactiveUser(), config, "2026-08-09")).toEqual({
			type: "none",
		});
	});

	it("warns 30 days before the account turns 18 months inactive", () => {
		expect(planInactivityAction(inactiveUser(), config, "2026-08-11")).toEqual({
			type: "warn",
			deletionDate: "2026-09-10",
		});
	});

	it("uses the Berlin date of the last login", () => {
		const user = inactiveUser({ last_active_at: "2025-03-09T23:30:00+00:00" });
		expect(planInactivityAction(user, config, "2026-08-11")).toEqual({
			type: "warn",
			deletionDate: "2026-09-10",
		});
	});

	it("gives overdue accounts the full warning period", () => {
		const user = inactiveUser({ last_active_at: "2023-01-01T12:00:00+00:00" });
		expect(planInactivityAction(user, config, "2026-11-05")).toEqual({
			type: "warn",
			deletionDate: "2026-12-05",
		});
	});

	it("waits after the warning until the reminder date", () => {
		expect(planInactivityAction(warnedUser(), config, "2026-09-02")).toEqual({
			type: "none",
		});
	});

	it("reminds 7 days before deletion", () => {
		expect(planInactivityAction(warnedUser(), config, "2026-09-03")).toEqual({
			type: "remind",
			deletionDate: "2026-09-10",
		});
	});

	it("does not remind twice", () => {
		const user = warnedUser({ reminder_sent_at: "2026-09-03T03:00:00+00:00" });
		expect(planInactivityAction(user, config, "2026-09-05")).toEqual({
			type: "none",
		});
	});

	it("deletes on the deletion date, also without a reminder", () => {
		expect(planInactivityAction(warnedUser(), config, "2026-09-10")).toEqual({
			type: "delete",
		});
	});

	it("cancels the deletion after a login", () => {
		const user = warnedUser({ last_active_at: "2026-09-08T10:00:00+00:00" });
		expect(planInactivityAction(user, config, "2026-09-10")).toEqual({
			type: "cancel",
		});
	});

	it("cancels the deletion of banned users", () => {
		const user = warnedUser({ is_banned: true });
		expect(planInactivityAction(user, config, "2026-09-10")).toEqual({
			type: "cancel",
		});
	});

	it("treats differently formatted equal timestamps as the same login", () => {
		const user = warnedUser({
			notified_last_active_at: "2025-03-10T10:00:00+01:00",
		});
		expect(planInactivityAction(user, config, "2026-09-10")).toEqual({
			type: "delete",
		});
	});
});

describe("emails", () => {
	const today = "2026-08-11";

	it("contains only the name, deletion date and links", () => {
		const email = buildWarningEmail({
			user: inactiveUser(),
			deletionDate: "2026-09-10",
			config,
			today,
			htmlTemplate: warningTemplate,
		});

		expect(email.subject).toBe("Ihr BärGPT-Konto wird am 10.09.2026 gelöscht");
		expect(email.text).toContain("Guten Tag Max Mustermann,");
		expect(email.text).toContain("seit über 17 Monaten");
		expect(email.text).toContain("18 Monate lang nicht genutzt");
		expect(email.text).toContain(
			"Melden Sie sich einfach bis zum 10.09.2026 an",
		);
		expect(email.text).toContain("https://www.baergpt.berlin/login/");
		expect(email.text).not.toContain("max@example.com");
		expect(email.html).toContain("Guten Tag Max Mustermann,");
		expect(email.html).toContain("<strong>10.09.2026</strong>");
		expect(email.html).toContain('href="https://www.baergpt.berlin/login/"');
		expect(email.html).not.toContain("{{");
	});

	it("greets without a name if none is set", () => {
		const email = buildWarningEmail({
			user: inactiveUser({ first_name: null, last_name: null }),
			deletionDate: "2026-09-10",
			config,
			today,
			htmlTemplate: warningTemplate,
		});

		expect(email.text.startsWith("Guten Tag,\n")).toBe(true);
	});

	it("states the days left in the reminder subject", () => {
		const reminder = (reminderToday: string) =>
			buildReminderEmail({
				user: inactiveUser(),
				deletionDate: "2026-09-10",
				config,
				today: reminderToday,
				htmlTemplate: reminderTemplate,
			});

		expect(reminder("2026-09-03").subject).toBe(
			"Erinnerung: Ihr BärGPT-Konto wird in 7 Tagen gelöscht",
		);
		expect(reminder("2026-09-09").subject).toBe(
			"Erinnerung: Ihr BärGPT-Konto wird morgen gelöscht",
		);
		expect(reminder("2026-09-03").text).toContain(
			"am 10.09.2026 wegen Inaktivität dauerhaft gelöscht",
		);
		expect(reminder("2026-09-03").html).toContain(
			"<strong>10.09.2026</strong>",
		);
		expect(reminder("2026-09-03").html).not.toContain("{{");
	});

	it("escapes user data in the HTML", () => {
		const email = buildWarningEmail({
			user: inactiveUser({ first_name: "<b>Max</b>", last_name: "O'Neil" }),
			deletionDate: "2026-09-10",
			config,
			today,
			htmlTemplate: warningTemplate,
		});

		expect(email.html).toContain(
			"Guten Tag &lt;b&gt;Max&lt;/b&gt; O&#39;Neil,",
		);
		expect(email.html).not.toContain("<b>Max</b>");
	});

	it("fails on placeholders without a value", () => {
		expect(() => renderTemplate("{{unknown}}", {})).toThrow(
			"Missing value for template placeholder {{unknown}}",
		);
	});
});
