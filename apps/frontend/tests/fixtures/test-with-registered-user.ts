import {
	defaultUserFirstName,
	defaultUserLastName,
	defaultUserPassword,
	defaultUserEmail,
} from "../constants.ts";
import { Page, expect } from "@playwright/test";
import { supabaseAdminClient } from "../supabase.ts";
import { testWithoutSplashScreen } from "./test-without-splash-screen.ts";

type TestWithRegisteredUser = {
	account: {
		email: string;
		password: string;
		id: string;
	};
};

export const testWithRegisteredUser =
	testWithoutSplashScreen.extend<TestWithRegisteredUser>({
		account: [
			async ({}, use) => {
				/**
				 * This happens before each test that uses this fixture.
				 */
				const email = defaultUserEmail;

				// A run that is cut short — Playwright's `maxFailures` aborting mid-test, or Ctrl-C —
				// never reaches the teardown below, so the user and its mails survive into the next
				// run. The address is a constant, so that leftover state is not harmless: creating the
				// user fails outright with "A user with this email address has already been
				// registered", and a stale mail would be picked up as if it were freshly sent.
				await deleteLeftoverUsers(email);
				await deleteLeftoverMails(email);

				const { data, error: createUserError } =
					await supabaseAdminClient.auth.admin.createUser({
						email,
						password: defaultUserPassword,
						email_confirm: true,
						user_metadata: {
							first_name: defaultUserFirstName,
							last_name: defaultUserLastName,
						},
					});

				testWithoutSplashScreen.expect(createUserError).toBeNull();
				testWithoutSplashScreen.expect(data).toBeDefined();

				if (createUserError) {
					throw new Error(`Failed to create user: ${createUserError.message}`);
				}

				const id = data.user.id;

				/**
				 * This runs the test that uses this fixture (and injects the account).
				 */
				await use({ email, password: defaultUserPassword, id });

				/**
				 * This happens after each test that uses this fixture.
				 */
				await cleanup(id);
			},
			{ scope: "test", auto: true },
		],
	});

async function cleanup(id: string) {
	const { error: deleteUserError } =
		await supabaseAdminClient.auth.admin.deleteUser(id);
	// Ignore "User not found" error as it means the user was already deleted
	if (deleteUserError?.message !== "User not found") {
		testWithRegisteredUser.expect(deleteUserError).toBeNull();
	}
}

/**
 * Removes any account left over from an earlier run so `createUser` below starts from a clean slate.
 */
async function deleteLeftoverUsers(email: string) {
	const wanted = email.toLowerCase();
	const { data, error } = await supabaseAdminClient.auth.admin.listUsers({
		perPage: 1000,
	});

	if (error) {
		throw new Error(`Failed to list users: ${error.message}`);
	}

	for (const user of data.users) {
		if (user.email?.toLowerCase() === wanted) {
			await cleanup(user.id);
		}
	}
}

const mailpitUrl = "http://localhost:54324";

/**
 * Empties the mailbox for `recipient` so `waitForLatestMessageTo` cannot return a mail — and with it
 * an already-expired security code — that an earlier run left behind.
 */
async function deleteLeftoverMails(recipient: string) {
	const wanted = recipient.toLowerCase();
	const list = await fetch(`${mailpitUrl}/api/v1/messages?limit=200`);

	if (!list.ok) {
		throw new Error(
			`Failed to list Mailpit messages at ${mailpitUrl}: ${list.status} ${list.statusText}`,
		);
	}

	const { messages } = (await list.json()) as { messages: MailpitSummary[] };
	const ids = messages
		.filter((message) =>
			message.To.some((to) => to.Address.toLowerCase() === wanted),
		)
		.map((message) => message.ID);

	if (ids.length === 0) {
		return;
	}

	await fetch(`${mailpitUrl}/api/v1/messages`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ IDs: ids }),
	});
}

type MailpitSummary = {
	ID: string;
	Created: string;
	To: { Address: string }[];
};

/**
 * Polls Mailpit for the most recent message addressed to `recipient` and returns its plain
 * text body, which carries both the security code and the confirmation link.
 */
async function waitForLatestMessageTo(
	page: Page,
	recipient: string,
	timeoutMs = 30_000,
) {
	const wanted = recipient.toLowerCase();
	const deadline = Date.now() + timeoutMs;
	let mailboxSize = 0;

	while (Date.now() < deadline) {
		const list = await page.request.get(
			`${mailpitUrl}/api/v1/messages?limit=200`,
		);

		if (list.ok()) {
			const { messages } = (await list.json()) as {
				messages: MailpitSummary[];
			};
			mailboxSize = messages.length;

			const newest = messages
				.filter((message) =>
					message.To.some((to) => to.Address.toLowerCase() === wanted),
				)
				.sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created))[0];

			if (newest) {
				const detail = await page.request.get(
					`${mailpitUrl}/api/v1/message/${newest.ID}`,
				);
				if (detail.ok()) {
					const { Text } = (await detail.json()) as { Text: string };
					return { id: newest.ID, text: Text };
				}
			}
		}

		await page.waitForTimeout(500);
	}

	throw new Error(
		`Timed out after ${timeoutMs}ms waiting for a Mailpit message addressed to ${recipient} (${mailboxSize} message(s) in the mailbox at ${mailpitUrl})`,
	);
}

export async function confirmOtp({
	page,
	account,
}: {
	page: Page;
	account: TestWithRegisteredUser["account"];
}) {
	const { id, text } = await waitForLatestMessageTo(page, account.email);

	// The security code sits on its own line; the button's href is the first confirm-otp link.
	const recoveryOtp = text.match(/^\s*(\d{6})\s*$/m)?.[1];
	const confirmUrl = text.match(/(https?:\/\/\S*?\/confirm-otp\/\S*)/)?.[1];

	if (!recoveryOtp || !confirmUrl) {
		throw new Error(
			`Could not read a security code and confirmation link from Mailpit message ${id}:\n${text}`,
		);
	}

	// Drop the consumed mail so a later confirmOtp in the same run cannot re-read it.
	const deletion = await page.request.delete(`${mailpitUrl}/api/v1/messages`, {
		data: { IDs: [id] },
	});
	if (!deletion.ok()) {
		throw new Error(
			`Could not delete Mailpit message ${id}: ${deletion.status()} ${deletion.statusText()}`,
		);
	}

	// The mail's button targets a new tab, so keep `page` on the app and confirm in a second one.
	const page1 = await page.context().newPage();
	await page1.goto(confirmUrl);

	await expect(
		page1.getByRole("heading", { name: "Aktion bestätigen" }),
	).toBeVisible();

	await page1
		.getByRole("textbox", { name: "Sicherheitscode" })
		.fill(recoveryOtp);
	await page1.getByRole("button", { name: "Weiter" }).click();

	return page1;
}
