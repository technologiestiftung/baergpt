import { Page } from "@playwright/test";

const mailpitUrl = "http://localhost:54324";

type MailpitSummary = {
	ID: string;
	Created: string;
	To: { Address: string }[];
};

/**
 * Polls Mailpit for the most recent message addressed to `recipient` and returns
 * its plain-text body, which carries the emailed one-time code.
 */
async function waitForLatestMessageTo(
	page: Page,
	recipient: string,
	timeoutMs = 30_000,
) {
	const wanted = recipient.toLowerCase();
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const list = await page.request.get(
			`${mailpitUrl}/api/v1/messages?limit=200`,
		);

		if (list.ok()) {
			const { messages } = (await list.json()) as {
				messages: MailpitSummary[];
			};

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
		`Timed out after ${timeoutMs}ms waiting for a Mailpit message addressed to ${recipient}`,
	);
}

/**
 * Reads the login one-time code from Mailpit and submits it on the admin-panel
 * confirm-otp page the login flow already navigated to. Unlike the frontend, the
 * emailed link points at the frontend origin, so the code is entered directly on
 * the current admin page instead of following the link.
 */
export async function enterLoginOtp(page: Page, email: string) {
	const { id, text } = await waitForLatestMessageTo(page, email);

	const code = text.match(/^\s*(\d{6})\s*$/m)?.[1];
	if (!code) {
		throw new Error(
			`Could not read a security code from Mailpit message ${id}:\n${text}`,
		);
	}

	// Drop the consumed mail so a later read in the same run cannot re-read it.
	await page.request.delete(`${mailpitUrl}/api/v1/messages`, {
		data: { IDs: [id] },
	});

	await page.getByRole("textbox", { name: "Sicherheitscode" }).fill(code);
	await page.getByRole("button", { name: "Weiter" }).click();
}
