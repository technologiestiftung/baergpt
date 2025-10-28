import { test, expect } from "@playwright/test";

test.describe("Cookie Banner", () => {
	test.beforeEach(async ({ page }, testInfo) => {
		// Clear localStorage for tests that need a fresh start
		// Skip clearing for tests that need to test persistence
		if (!testInfo.title.includes("subsequent visits after consent")) {
			await page.addInitScript(() => {
				window.localStorage.clear();
			});
		}
	});

	test("should display cookie banner on first visit to public page", async ({
		page,
	}) => {
		await page.goto("/privacy-policy/");

		// Wait for page to load
		await page.waitForLoadState("networkidle");

		// Check if cookie banner appears at all
		await expect(page.getByText("Cookies-Einstellungen")).toBeVisible();

		// Check that compact banner content is displayed initially
		await expect(
			page.getByText(/Wir verwenden technisch notwendige Cookies/),
		).toBeVisible();
	});

	test("should accept all cookies when clicking 'Akzeptieren' in compact mode", async ({
		page,
	}) => {
		await page.goto("/privacy-policy/");

		// Wait for cookie banner to be visible
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();

		// Click "Akzeptieren" in compact mode
		await page.getByRole("button", { name: /Akzeptieren/ }).click();

		// Cookie banner should disappear
		await expect(
			page.getByRole("region", { name: /Cookie/ }),
		).not.toBeVisible();

		// Check that consent was stored in localStorage
		const consent = await page.evaluate(() =>
			localStorage.getItem("vimeo-cookies-consent"),
		);
		const consentType = await page.evaluate(() =>
			localStorage.getItem("vimeo-cookies-consent-type"),
		);

		expect(consent).toBe("accepted");
		expect(consentType).toBe("all");
	});

	test("should decline cookies when clicking 'Ablehnen'", async ({ page }) => {
		await page.goto("/privacy-policy/");

		// Wait for cookie banner to be visible
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();

		// Click "Ablehnen"
		await page.getByRole("button", { name: /Ablehnen/ }).click();

		// Cookie banner should disappear
		await expect(
			page.getByRole("region", { name: /Cookie/ }),
		).not.toBeVisible();

		// Check that consent was declined in localStorage
		const consent = await page.evaluate(() =>
			localStorage.getItem("vimeo-cookies-consent"),
		);
		const consentType = await page.evaluate(() =>
			localStorage.getItem("vimeo-cookies-consent-type"),
		);

		expect(consent).toBe("declined");
		expect(consentType).toBe("necessary-only");
	});

	test("should expand cookie banner when clicking 'Mehr erfahren'", async ({
		page,
	}) => {
		await page.goto("/privacy-policy/");

		// Wait for cookie banner to be visible
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();

		// Click "Mehr erfahren"
		await page.getByText(/Mehr erfahren/).click();

		// Expanded banner content should be visible
		await expect(page.getByText(/Externe Medien/)).toBeVisible();

		// Check for the long description text that appears in expanded mode
		await expect(
			page.getByText(
				/Wir verwenden technisch notwendige Cookies, um die Funktionalität/,
			),
		).toBeVisible();
	});
	test("should toggle third-party cookies and accept selection", async ({
		page,
	}) => {
		await page.goto("/privacy-policy/");

		// Wait for cookie banner to be visible and expand it
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();
		await page.getByText(/Mehr erfahren/).click();

		// Check that we're in expanded mode
		await expect(page.getByText(/Externe Medien/)).toBeVisible();

		// Find the third-party cookies switch (it should be unchecked by default)
		const thirdPartyCookiesSwitch = page.locator('input[type="checkbox"]');
		await expect(thirdPartyCookiesSwitch).not.toBeChecked();

		// Click on the switch label to enable third-party cookies
		// The Switch component uses a label that wraps the hidden checkbox
		await page
			.locator("label")
			.filter({ has: page.locator('input[type="checkbox"]') })
			.click();
		await expect(thirdPartyCookiesSwitch).toBeChecked();

		// Click "Auswahl bestätigen" button (handles Unicode normalization for umlaut)
		// Use a flexible regex pattern that handles Unicode variations
		const confirmButton = page
			.locator("button")
			.filter({ hasText: /Auswahl.*best.*tigen/ });
		await expect(confirmButton).toBeVisible({ timeout: 10000 });
		await confirmButton.click();

		// Cookie banner should disappear
		await expect(
			page.getByRole("region", { name: /Cookie/ }),
		).not.toBeVisible();

		// Check that consent was stored with third-party cookies enabled
		const consent = await page.evaluate(() =>
			localStorage.getItem("vimeo-cookies-consent"),
		);
		const consentType = await page.evaluate(() =>
			localStorage.getItem("vimeo-cookies-consent-type"),
		);

		expect(consent).toBe("accepted");
		expect(consentType).toBe("third-party-only");
	});

	test("should not accept third-party cookies if only necessary cookies are accepted", async ({
		page,
	}) => {
		await page.goto("/privacy-policy/");

		// Wait for cookie banner to be visible and expand it
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();
		await page.getByText(/Mehr erfahren/).click();

		// Check that we're in expanded mode
		await expect(page.getByText(/Externe Medien/)).toBeVisible();

		// Find the third-party cookies switch (it should be unchecked by default)
		const thirdPartyCookiesSwitch = page.locator('input[type="checkbox"]');
		await expect(thirdPartyCookiesSwitch).not.toBeChecked();

		// Keep the switch disabled (unchecked) and click "Nur notwendige" to accept only necessary cookies
		await page.getByRole("button", { name: /Nur notwendige/ }).click();

		// Cookie banner should disappear
		await expect(
			page.getByRole("region", { name: /Cookie/ }),
		).not.toBeVisible();

		// Check that consent was stored with only necessary cookies
		const consent = await page.evaluate(() =>
			localStorage.getItem("vimeo-cookies-consent"),
		);
		const consentType = await page.evaluate(() =>
			localStorage.getItem("vimeo-cookies-consent-type"),
		);

		expect(consent).toBe("declined");
		expect(consentType).toBe("necessary-only");
	});

	test("should not display cookie banner on subsequent visits after consent", async ({
		page,
	}) => {
		// First visit - accept cookies
		await page.goto("/privacy-policy/");
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();
		await page.getByRole("button", { name: /Akzeptieren/ }).click();

		// Wait for banner to disappear after accepting
		await expect(
			page.getByRole("region", { name: /Cookie/ }),
		).not.toBeVisible();

		// Reload page - cookie banner should not appear
		await page.reload();
		await page.waitForLoadState("networkidle");
		await expect(
			page.getByRole("region", { name: /Cookie/ }),
		).not.toBeVisible();
	});

	test("should display cookie banner on pages that load without authentication", async ({
		page,
	}) => {
		// Test on privacy policy page
		await page.goto("/privacy-policy/");
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();

		// Accept cookies and clear localStorage for next test
		await page.getByRole("button", { name: /Akzeptieren/ }).click();
		await page.evaluate(() => window.localStorage.clear());

		// Test on landing page
		await page.goto("/");
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();
	});

	test("should block videos when cookies are declined", async ({ page }) => {
		await page.goto("/");

		// Wait for cookie banner to be visible
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();

		// Decline cookies
		await page.getByRole("button", { name: /Ablehnen/ }).click();

		// Wait for banner to disappear
		await expect(
			page.getByRole("region", { name: /Cookie/ }),
		).not.toBeVisible();

		// Video should be blocked - check for blocked message
		await expect(page.getByText("Video-Inhalt blockiert")).toBeVisible();
		await expect(
			page.getByText(/Dieses Video wird von Vimeo bereitgestellt/),
		).toBeVisible();

		// Should see "Cookies akzeptieren" button on blocked video
		await expect(
			page.getByRole("button", { name: /Cookies akzeptieren/ }),
		).toBeVisible();

		// Should NOT see the actual video iframe
		await expect(page.locator("iframe")).not.toBeVisible();
	});

	test("should load videos when cookies are accepted", async ({ page }) => {
		await page.goto("/");

		// Wait for cookie banner to be visible
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();

		// Accept cookies
		await page.getByRole("button", { name: /Akzeptieren/ }).click();

		// Wait for banner to disappear
		await expect(
			page.getByRole("region", { name: /Cookie/ }),
		).not.toBeVisible();

		// Video should be loaded - check for iframe
		await expect(page.locator("iframe")).toBeVisible();

		// Should NOT see blocked message
		await expect(page.getByText("Video-Inhalt blockiert")).not.toBeVisible();
		await expect(
			page.getByRole("button", { name: /Cookies akzeptieren/ }),
		).not.toBeVisible();
	});

	test("should dispatch custom event when cookies are accepted", async ({
		page,
	}) => {
		// Listen for the custom event
		interface CookieEventDetail {
			type: string;
			thirdPartyCookies: boolean;
		}

		await page.addInitScript(() => {
			window.addEventListener("cookies-accepted", (event) => {
				const customEvent = event as CustomEvent<CookieEventDetail>;
				(
					window as typeof window & { cookieEventDetails: CookieEventDetail }
				).cookieEventDetails = customEvent.detail;
			});
		});

		await page.goto("/privacy-policy/");

		// Accept all cookies
		await expect(page.getByRole("region", { name: /Cookie/ })).toBeVisible();
		await page.getByRole("button", { name: /Akzeptieren/ }).click();

		// Check that the custom event was dispatched with correct details
		const eventDetails = await page.evaluate(
			() =>
				(window as typeof window & { cookieEventDetails: CookieEventDetail })
					.cookieEventDetails,
		);
		expect(eventDetails).toEqual({
			type: "all",
			thirdPartyCookies: true,
		});
	});
});
