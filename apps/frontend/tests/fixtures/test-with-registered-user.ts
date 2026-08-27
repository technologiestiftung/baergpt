import {
	defaultUserFirstName,
	defaultUserLastName,
	defaultUserPassword,
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
				// Unique per test so parallel workers never collide on the same
				// auth user (duplicate create / one test's cleanup deleting
				// another's user). Keep the display name fixed — some specs assert
				// on the "john doe" welcome heading.
				const userId = crypto.randomUUID();
				const email = `${defaultUserFirstName}.${defaultUserLastName}+${userId}@ts.berlin`;

				try {
					/**
					 * This happens before each test that uses this fixture.
					 */

					const { data, error: createUserError } =
						await supabaseAdminClient.auth.admin.createUser({
							id: userId,
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
						throw new Error(
							`Failed to create user: ${createUserError.message}`,
						);
					}

					/**
					 * This runs the test that uses this fixture (and injects the account).
					 */
					await use({ email, password: defaultUserPassword, id: userId });
				} finally {
					/**
					 * This happens after each test that uses this fixture.
					 */
					await cleanup(userId);
				}
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

const mailpitUrl = "http://localhost:54324";

type MailpitSummary = {
	ID: string;
	Created: string;
	To: { Address: string }[];
};

/**
 * Polls Mailpit for the most recent message addressed to `recipient` and returns its plain
 * text body, which carries both the security code and the confirmation link.
 */
async function waitForLatestMessageTo(args: {
	page: Page;
	recipient: string;
	timeoutMs?: number;
	cutoffTime?: number; // Only consider messages created after this UTC timestamp (ms-since-epoch).
}) {
	const { page, recipient, timeoutMs = 30_000, cutoffTime } = args;

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

			const filtered = messages.filter((message) => {
				const matchesRecipient = message.To.some(
					(to) => to.Address.toLowerCase() === wanted,
				);
				const afterCutoff =
					cutoffTime === undefined
						? true
						: Date.parse(message.Created) > cutoffTime;
				return matchesRecipient && afterCutoff;
			});

			const newest = filtered.sort(
				(a, b) => Date.parse(b.Created) - Date.parse(a.Created),
			)[0];

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
	const { id, text } = await waitForLatestMessageTo({
		page,
		recipient: account.email,
	});

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

/**
 * Finds a user by email, paginating through `auth.admin.listUsers` beyond the
 * first page. `listUsers` returns only one page (default 50 users), so a lookup
 * against the first page alone misses users once the project grows past it.
 * Returns the matching user or `null` if no user has that email.
 */
export async function findUserByEmail(email: string) {
	for (let page = 1; ; page++) {
		const { data, error } = await supabaseAdminClient.auth.admin.listUsers({
			page,
		});
		if (error) {
			throw new Error(`Failed to list users: ${error.message}`);
		}

		const found = data.users.find((user) => user.email === email);
		if (found) {
			return found;
		}

		if (data.users.length === 0) {
			return null;
		}
	}
}
