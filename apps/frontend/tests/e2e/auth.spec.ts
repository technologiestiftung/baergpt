import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
	confirmOtp,
	findUserByEmail,
	testWithRegisteredUser,
} from "../fixtures/test-with-registered-user.ts";
import { authStorageKey, supabaseAdminClient } from "../supabase.ts";
import {
	defaultUserFirstName,
	defaultUserLastName,
	MOCK_SPLASH_RELEASE_SHA,
	VERSION_STORAGE_KEY,
} from "../constants.ts";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import { testWithoutSplashScreen } from "../fixtures/test-without-splash-screen.ts";
import Content from "../../src/content.ts";
import { expectGreeting } from "./helpers/greeting.ts";

/**
 * Passwordless login: enter the email, request a one-time code, then read the
 * code from Mailpit and submit it on the confirm-otp page. confirmOtp opens the
 * emailed link in a new tab and returns that (now authenticated) page.
 */
async function loginViaOtp(page: Page, account: { email: string; id: string }) {
	await page.goto("/login/");
	await page
		.getByRole("textbox", { name: "E-Mail-Adresse" })
		.fill(account.email);
	await page.getByRole("button", { name: "Einmalcode erhalten" }).click();
	return confirmOtp({ page, account });
}

/**
 * Logs the account in via OTP in a fresh browser context (separate localStorage),
 * like signing in from a second browser. Each OTP login creates its own session.
 */
async function openLoggedInBrowser(
	browser: Browser,
	account: { email: string; id: string },
) {
	const context = await browser.newContext();
	await context.route(
		(url) =>
			url.hostname === "api.github.com" &&
			/^\/repos\/[^/]+\/[^/]+\/commits\//.test(url.pathname),
		(route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ sha: MOCK_SPLASH_RELEASE_SHA }),
			}),
	);
	await context.addInitScript(
		({ versionKey, sha }) => localStorage.setItem(versionKey, sha),
		{ versionKey: VERSION_STORAGE_KEY, sha: MOCK_SPLASH_RELEASE_SHA },
	);
	const page = await loginViaOtp(await context.newPage(), account);
	await expectGreeting(page, `${defaultUserFirstName} ${defaultUserLastName}`);
	return page;
}

async function logout(page: Page) {
	await page.getByRole("button", { name: "Profil öffnen" }).click();
	await page.getByRole("button", { name: "Ausloggen" }).click();
	await expect(
		page.getByText("BärGPT, der KI-Assistent für die Berliner Verwaltung"),
	).toBeVisible();
}

test.describe("Login", () => {
	testWithRegisteredUser("User Login and Logout", async ({ page, account }) => {
		const page1 = await loginViaOtp(page, account);

		// Check if we are on the main page
		await expectGreeting(
			page1,
			`${defaultUserFirstName} ${defaultUserLastName}`,
		);

		// Click on the drop-down button
		await page1.getByRole("button", { name: "Profil öffnen" }).click();

		// Click on the log-out button
		await page1.getByRole("button", { name: "Ausloggen" }).click();

		// Check if we are back on the landing page
		await expect(
			page1.getByText("BärGPT, der KI-Assistent für die Berliner Verwaltung"),
		).toBeVisible();
	});

	testWithRegisteredUser(
		"Logout in a second browser still logs out after a global logout in the first",
		async ({ browser, account }) => {
			// Regression test: auth-js < 2.91.2 kept the session in localStorage when
			// /logout answered 403 session_not_found, so a reload logged the user back in.
			const browserA = await openLoggedInBrowser(browser, account);
			const browserB = await openLoggedInBrowser(browser, account);

			// Global logout (supabase-js default scope) revokes browser B's session too
			await logout(browserA);

			const logoutResponse = browserB.waitForResponse((response) =>
				response.url().includes("/auth/v1/logout"),
			);
			await logout(browserB);
			// Server rejects B's logout since its session is already gone
			expect((await logoutResponse).status()).toBe(403);

			expect(
				await browserB.evaluate(
					(key) => localStorage.getItem(key),
					authStorageKey,
				),
			).toBeNull();

			await browserB.reload();
			await expect(
				browserB.getByText(
					"BärGPT, der KI-Assistent für die Berliner Verwaltung",
				),
			).toBeVisible();
			await expect(
				browserB.getByRole("button", { name: "Profil öffnen" }),
			).toBeHidden();

			await browserA.context().close();
			await browserB.context().close();
		},
	);

	test("Invalid Login Attempt", async ({ page }) => {
		// Go to the login page
		await page.goto("/login/");

		// Try to request a code with an empty email field
		await page.getByRole("button", { name: "Einmalcode erhalten" }).click();

		// Email field should show a validation error
		await expect(page.getByText("Bitte füllen Sie dieses Feld")).toBeVisible();

		// Fill in the email field with an invalid email format
		await page.locator("#email").fill("some-invalid-email");

		// Try to request a code again
		await page.getByRole("button", { name: "Einmalcode erhalten" }).click();

		// Email field should show a format validation error
		await expect(page.getByText("Das E-Mail-Format ist falsch.")).toBeVisible();
	});

	test("Confirm-otp page reached via login links back to login to change the email", async ({
		page,
	}) => {
		// Requesting a code creates the account, so it is deleted afterwards
		const email = `confirm-otp-footer-check+${crypto.randomUUID()}@ts.berlin`;

		try {
			await requestCodeOnLoginPage(page, email);

			await expect(page).toHaveURL(/\/confirm-otp\//);
			await expect(
				page.getByRole("link", { name: "E-Mail-Adresse ändern" }),
			).toHaveAttribute("href", "/login/");
		} finally {
			const foundUser = await findUserByEmail(email);
			if (foundUser) {
				await supabaseAdminClient.auth.admin.deleteUser(foundUser.id);
			}
		}
	});
});

async function getProfileAndAccessGroupCount(userId: string) {
	const { data: profile } = await supabaseAdminClient
		.from("profiles")
		.select("first_name, last_name")
		.eq("id", userId)
		.maybeSingle();

	const { count } = await supabaseAdminClient
		.from("access_group_members")
		.select("*", { count: "exact", head: true })
		.eq("user_id", userId);

	return { profile, accessGroupCount: count };
}

async function requestCodeOnLoginPage(page: Page, email: string) {
	await page.goto("/login/");

	await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);

	// Wait for the passwordless sign-up (OTP) request to complete
	await Promise.all([
		page.waitForResponse(
			(resp) => resp.url().includes("/auth/v1/otp") && resp.status() === 200,
		),
		page.getByRole("button", { name: "Einmalcode erhalten" }).click(),
	]);
}

test.describe("User Registration (uses different user to prevent side-effects on other tests)", () => {
	// Unique per test so parallel workers never register the same email or have
	// one test's afterEach delete another's user. A worker runs its tests
	// serially, so a single module-scoped variable set in beforeEach is safe.
	let givenUserEmail: string;
	const givenUserFirstName = "User";
	const givenUserLastName = "Registration";

	testWithoutSplashScreen.beforeEach(() => {
		givenUserEmail = `user.registration+${crypto.randomUUID()}@ts.berlin`;
	});

	testWithoutSplashScreen.afterEach(async () => {
		const foundUser = await findUserByEmail(givenUserEmail);

		if (!foundUser) {
			return;
		}

		const { error: deleteUserError } =
			await supabaseAdminClient.auth.admin.deleteUser(foundUser.id);

		expect(deleteUserError).toBeNull();
	});

	testWithoutSplashScreen("Default Registration Flow", async ({ page }) => {
		await requestCodeOnLoginPage(page, givenUserEmail);

		const page1 = await confirmOtp({
			page,
			account: {
				email: givenUserEmail,
				id: "", // id is not needed for this flow
			},
		});

		await expect(page1).toHaveURL("/register/");

		const user = await findUserByEmail(givenUserEmail);
		if (!user) {
			throw new Error("User was not created");
		}

		expect(await getProfileAndAccessGroupCount(user.id)).toStrictEqual({
			profile: null,
			accessGroupCount: 0,
		});

		const submitButton = page1.getByRole("button", { name: "Konto eröffnen" });
		await expect(submitButton).toBeDisabled();

		await page1
			.getByRole("textbox", { name: "Vorname" })
			.fill(givenUserFirstName);
		await page1
			.getByRole("textbox", { name: "Nachname" })
			.fill(givenUserLastName);

		await page1
			.locator('[data-testid="label-has-accepted-privacy-checkbox"]')
			.click();

		await submitButton.click();

		await expect(page1).toHaveURL("/");

		await expectGreeting(page1, `${givenUserFirstName} ${givenUserLastName}`);

		expect(await getProfileAndAccessGroupCount(user.id)).toStrictEqual({
			profile: { first_name: givenUserFirstName, last_name: givenUserLastName },
			accessGroupCount: 1,
		});
	});

	testWithoutSplashScreen(
		"Resend button re-requests a one-time code with just the email",
		async ({ page }) => {
			await requestCodeOnLoginPage(page, givenUserEmail);

			await expect(
				page.getByRole("heading", { name: "Einmalcode eingeben" }),
			).toBeVisible({ timeout: 10_000 });

			const resendButton = page.getByRole("button", {
				name: "Einmalcode nochmal senden",
			});

			const [resendRequest] = await Promise.all([
				page.waitForRequest(
					(request) =>
						request.url().includes("/auth/v1/otp") &&
						request.method() === "POST",
				),
				resendButton.click(),
			]);

			expect(resendRequest.postDataJSON().email).toEqual(givenUserEmail);

			await expect(
				page.getByText(Content["confirmOtp.resend.success"]),
			).toBeVisible();
		},
	);
});

testWithoutSplashScreen(
	"Try to log in with not allowed user",
	async ({ page }) => {
		await page.goto("/login/");

		// Wait for check email allowed to be loaded before proceeding
		const emailAllowedCheck = page
			.waitForResponse((resp) => resp.url().includes("check_email_allowed"), {
				timeout: 10_000,
			})
			.catch(() => {}); // Ignore if already completed

		const emailInput = page.getByRole("textbox", { name: "E-Mail-Adresse" });
		await emailInput.click();
		await emailInput.pressSequentially("not-allowed@example.com");
		await emailInput.blur();

		await emailAllowedCheck;

		const errorMessage = page.getByText(
			"E-Mail nicht zulässig. Bei Fragen support@baergpt.berlin kontaktieren.",
		);
		await expect(errorMessage).toBeVisible();
	},
);

testWithRegisteredUser.describe("User ban", async () => {
	async function banUser(userId: string) {
		const { error } = await supabaseAdminClient.auth.admin.updateUserById(
			userId,
			{
				ban_duration: "876000h", // 100 years
			},
		);

		expect(error).toBeNull();
	}

	async function unbanUser(userId: string) {
		const { error } = await supabaseAdminClient.auth.admin.updateUserById(
			userId,
			{
				ban_duration: "none",
			},
		);

		expect(error).toBeNull();
	}

	testWithRegisteredUser.afterEach(async ({ account }) => {
		await unbanUser(account.id);
	});

	testWithRegisteredUser(
		"Logged-in user is logged out when their account is banned",
		async ({ page, account, baseURL }) => {
			// Log in via OTP while the account is active.
			const page1 = await loginViaOtp(page, account);
			await expectGreeting(
				page1,
				`${defaultUserFirstName} ${defaultUserLastName}`,
			);

			// Ban the user account in the database.
			await banUser(account.id);

			// On the next navigation the app detects the ban and logs the user out.
			await page1.goto("/");
			await expect(
				page1.getByRole("heading", {
					name: "BärGPT, der KI-Assistent für die Berliner Verwaltung",
				}),
			).toBeVisible();

			// Unban and confirm the user can log in again via a fresh OTP.
			await unbanUser(account.id);

			const page2 = await loginViaOtp(page1, account);
			await expectGreeting(
				page2,
				`${defaultUserFirstName} ${defaultUserLastName}`,
			);
			await expect(page2).toHaveURL(`${baseURL}/`);
		},
	);
});

testWithLoggedInUser(
	"Logged-In User should be logged out when their account is deleted",
	async ({ page, account }) => {
		// Step 1: Go to the app (user is already logged in via fixture)
		await page.goto("/");

		// Verify user is logged in
		await expectGreeting(
			page,
			`${defaultUserFirstName} ${defaultUserLastName}`,
		);

		// Step 2: Delete the account in the database, without ever signing the
		// browser session out — simulates a still-valid access token for an
		// account that has since been deleted (e.g. deleted from another
		// session, or by an admin).
		const { error: deleteError } =
			await supabaseAdminClient.auth.admin.deleteUser(account.id);
		expect(deleteError).toBeNull();

		// Step 3: Reload the page to trigger the deletion check
		await page.reload();

		// Step 4: Verify user is redirected to the landing page (logged out)
		await expect(
			page.getByRole("heading", {
				name: "BärGPT, der KI-Assistent für die Berliner Verwaltung",
			}),
		).toBeVisible();
	},
);

testWithLoggedInUser(
	"should allow user to change email address",
	async ({ page, account }) => {
		const updatedEmail = `john.doe-${crypto.randomUUID()}@polizei.berlin.de`;
		const updatedAccount = {
			...account,
			email: updatedEmail,
		};

		await page.goto("/profile/");
		// Wait for allowed email domains to be loaded before filling the form
		await page
			.waitForResponse(
				(resp) => resp.url().includes("get_allowed_email_domains"),
				{ timeout: 10000 },
			)
			.catch(() => {}); // Ignore if already completed

		await expect(page.locator("#email")).toHaveValue(account.email);

		// Fill in the email field with new data
		await page.locator("#email").fill(updatedEmail);

		const submitEmailChangeButton = page.getByRole("button", {
			name: "E-Mail-Adresse ändern",
		});
		await submitEmailChangeButton.click();

		const confirmationModal = page.getByRole("heading", {
			name: "Verifizierungs-E-Mail",
		});
		await expect(confirmationModal).toBeVisible();

		const closeConfirmationModal = page.getByRole("button", {
			name: "E-Mail-Dialog schließen",
		});
		await closeConfirmationModal.click();

		const emailChangeInfo = page.getByText("Sie haben die Änderung Ihrer");
		await expect(emailChangeInfo).toBeVisible();

		const page1 = await confirmOtp({ page, account: updatedAccount });

		const emailChangeSuccessfulPage = page1.getByRole("heading", {
			name: "Ihre neue E-Mail-Adresse",
		});
		await expect(emailChangeSuccessfulPage).toBeVisible();

		const linkToBaerGPTHomePage = page1.getByRole("link", {
			name: "Zu BärGPT",
		});
		await linkToBaerGPTHomePage.click();

		await expectGreeting(
			page1,
			`${defaultUserFirstName} ${defaultUserLastName}`,
		);
	},
);
