import { expect } from "@playwright/test";
import {
	testWithRegisteredUser,
	waitForLatestMessageTo,
} from "../fixtures/test-with-registered-user.ts";

/**
 * The login email links to the confirm-otp page with the one-time code in the
 * URL fragment (#token=...). The page reads it client-side and prefills the code
 * field; the user still submits manually. This exercises the whole chain from
 * Mailpit, so it guards the template<->frontend contract (both must agree on the
 * "token" fragment key) and the after-mount strip.
 */
testWithRegisteredUser.describe("Login OTP email link prefill", () => {
	testWithRegisteredUser(
		"the login email link carries the code in a #token fragment and prefills the field",
		async ({ page, account }) => {
			// Request a login code the normal way.
			await page.goto("/login/");
			await page
				.getByRole("textbox", { name: "E-Mail-Adresse" })
				.fill(account.email);
			await page.getByRole("button", { name: "Code anfordern" }).click();

			// Read the emailed code and link straight from Mailpit.
			const { text } = await waitForLatestMessageTo(page, account.email);
			const code = text.match(/^\s*(\d{6})\s*$/m)?.[1];
			const confirmUrl = text.match(/(https?:\/\/\S*?\/confirm-otp\/\S*)/)?.[1];
			if (!code || !confirmUrl) {
				throw new Error(
					`Could not read a security code and link from the email:\n${text}`,
				);
			}

			// The code must ride in the URL fragment (kept off the server), not a
			// query param. This is the template<->frontend "token" contract.
			expect(confirmUrl).toContain(`#token=${code}`);

			// Opening the link prefills the code field — no manual typing.
			const page1 = await page.context().newPage();
			await page1.goto(confirmUrl);
			await expect(
				page1.getByRole("textbox", { name: "Sicherheitscode" }),
			).toHaveValue(code);

			// ...and the token is stripped from the URL so it doesn't linger.
			await expect(page1).not.toHaveURL(/#token/);
		},
	);
});
