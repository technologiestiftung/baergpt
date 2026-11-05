import { expect, type Page } from "@playwright/test";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import Content from "../../src/content";
import type { Integration } from "../../src/api/integrations/get-integrations.ts";
import { formatMaskedToken } from "../../src/components/connectors/format-masked-token.ts";

const REQUIRED_SCOPES = [
	"chart:read",
	"chart:write",
	"theme:read",
	"visualization:read",
];
const VALID_TOKEN = "dw-test-token-valid-4f2b";
const STORED_INTEGRATION: Integration = {
	provider: "datawrapper",
	last4: "9a1c",
	scopes: REQUIRED_SCOPES,
	updated_at: "2026-01-01T00:00:00.000Z",
};

type MockIntegrationsApiOptions = {
	/** Key stored before the page loads */
	integration?: Integration | null;
	/** Response to saving a key; a 204 stores it */
	saveResponse?: { status: number; body?: object };
	/** Status for removing the key; a 204 removes it */
	deleteStatus?: number;
};

/**
 * Mocks the backend's integrations endpoints with in-memory state, so no real
 * Datawrapper token is needed and the UI sees the same responses the backend
 * gives for valid, invalid and missing-scope keys.
 */
async function mockIntegrationsApi(
	page: Page,
	{
		integration = null,
		saveResponse = { status: 204 },
		deleteStatus = 204,
	}: MockIntegrationsApiOptions = {},
) {
	let storedIntegration = integration;
	const savedKeys: string[] = [];

	await page.route("**/integrations", async (route) => {
		await route.fulfill({
			status: 200,
			json: storedIntegration ? [storedIntegration] : [],
		});
	});

	await page.route("**/integrations/datawrapper/key", async (route) => {
		const method = route.request().method();

		if (method === "PUT") {
			const { key } = route.request().postDataJSON() as { key: string };
			savedKeys.push(key);

			if (saveResponse.status === 204) {
				storedIntegration = {
					provider: "datawrapper",
					last4: key.slice(-4),
					scopes: REQUIRED_SCOPES,
					updated_at: new Date().toISOString(),
				};
				await route.fulfill({ status: 204 });
				return;
			}

			await route.fulfill({
				status: saveResponse.status,
				json: saveResponse.body ?? {},
			});
			return;
		}

		if (method === "DELETE") {
			if (deleteStatus === 204) {
				storedIntegration = null;
			}
			await route.fulfill({ status: deleteStatus });
			return;
		}

		await route.fallback();
	});

	return { savedKeys };
}

const connectDialog = (page: Page) =>
	page.locator("#datawrapper-connect-dialog");
const disconnectDialog = (page: Page) =>
	page.locator("#datawrapper-disconnect-dialog");

/** The desktop table and the mobile list are both rendered; only one is visible */
const visibleText = (page: Page, text: string) =>
	page.getByText(text, { exact: true }).filter({ visible: true });

async function openConnectDialog(page: Page) {
	await page
		.getByRole("button", {
			name: Content["connectors.datawrapper.connectButton"],
			exact: true,
		})
		.click();
	await expect(connectDialog(page)).toBeVisible();
}

/** Desktop has its own buttons per row; mobile opens the ⋮ bottom sheet */
async function chooseConnectedAction(
	page: Page,
	isMobile: boolean,
	action: "edit" | "disconnect",
) {
	if (!isMobile) {
		await page
			.getByRole("button", {
				name:
					action === "edit"
						? Content["connectors.datawrapper.editButton.ariaLabel"]
						: Content["connectors.datawrapper.deleteButton.ariaLabel"],
			})
			.click();
		return;
	}

	await page
		.getByRole("button", {
			name: Content["connectors.datawrapper.menuButton.ariaLabel"],
		})
		.click();

	const sheet = page.getByRole("dialog", {
		name: Content["connectors.datawrapper.sheet.title"],
	});
	await expect(sheet).toBeVisible();

	await sheet
		.getByRole("button", {
			name:
				action === "edit"
					? Content["connectors.datawrapper.menu.edit"]
					: Content["connectors.datawrapper.menu.disconnect"],
			exact: true,
		})
		.click();
	await expect(sheet).toBeHidden();
}

async function submitToken(page: Page, label: string, token: string) {
	const dialog = connectDialog(page);
	await dialog.getByLabel(label, { exact: true }).fill(token);
	await dialog
		.getByRole("button", {
			name:
				label === Content["connectors.datawrapper.newTokenLabel"]
					? Content["connectors.datawrapper.replaceSubmitButton"]
					: Content["connectors.datawrapper.connectSubmitButton"],
			exact: true,
		})
		.click();
}

testWithLoggedInUser.describe("Datawrapper connector", () => {
	testWithLoggedInUser.beforeEach(() => {
		testWithLoggedInUser.skip(
			process.env.VITE_FEATURE_FLAG_MCP_DATAWRAPPER_ALLOWED !== "true",
			"Datawrapper connector is behind VITE_FEATURE_FLAG_MCP_DATAWRAPPER_ALLOWED",
		);
	});

	testWithLoggedInUser("connects a valid API token", async ({ page }) => {
		const { savedKeys } = await mockIntegrationsApi(page);
		await page.goto("/profile/");

		await openConnectDialog(page);
		await submitToken(
			page,
			Content["connectors.datawrapper.tokenLabel"],
			`  ${VALID_TOKEN}  `,
		);

		const dialog = connectDialog(page);
		await expect(
			dialog.getByRole("heading", {
				name: Content["connectors.datawrapper.connectSuccess.title"],
			}),
		).toBeVisible();
		// The token is trimmed before it is sent
		expect(savedKeys).toEqual([VALID_TOKEN]);

		await dialog
			.getByRole("button", {
				name: Content["connectors.datawrapper.successContinueButton"],
			})
			.click();
		await expect(dialog).toBeHidden();

		await expect(
			visibleText(page, formatMaskedToken(VALID_TOKEN.slice(-4))),
		).toBeVisible();
		await expect(
			page.getByRole("button", {
				name: Content["connectors.datawrapper.connectButton"],
				exact: true,
			}),
		).toBeHidden();
	});

	testWithLoggedInUser(
		"shows an error for an invalid token",
		async ({ page }) => {
			const { savedKeys } = await mockIntegrationsApi(page, {
				saveResponse: { status: 422, body: { error: "Invalid API key" } },
			});
			await page.goto("/profile/");

			await openConnectDialog(page);
			await submitToken(
				page,
				Content["connectors.datawrapper.tokenLabel"],
				"not-a-real-token",
			);

			const dialog = connectDialog(page);
			await expect(
				dialog.getByRole("alert").filter({
					hasText: Content["connectors.datawrapper.error.invalid"],
				}),
			).toBeVisible();
			await expect(
				dialog.getByLabel(Content["connectors.datawrapper.tokenLabel"], {
					exact: true,
				}),
			).toHaveAttribute("aria-invalid", "true");
			expect(savedKeys).toEqual(["not-a-real-token"]);

			// Nothing was connected
			await dialog
				.getByRole("button", {
					name: Content["connectors.datawrapper.cancelButton"],
				})
				.click();
			await expect(
				page.getByRole("button", {
					name: Content["connectors.datawrapper.connectButton"],
					exact: true,
				}),
			).toBeVisible();
		},
	);

	testWithLoggedInUser(
		"explains which scopes a token is missing",
		async ({ page, isMobile }) => {
			await mockIntegrationsApi(page, {
				saveResponse: {
					status: 422,
					body: {
						error: "API key is missing required scopes",
						requiredScopes: REQUIRED_SCOPES,
					},
				},
			});
			await page.goto("/profile/");

			await openConnectDialog(page);
			await submitToken(
				page,
				Content["connectors.datawrapper.tokenLabel"],
				"dw-token-without-theme-read",
			);

			const dialog = connectDialog(page);
			await expect(
				dialog.getByRole("alert").filter({
					hasText: Content["connectors.datawrapper.error.missingScopes"],
				}),
			).toBeVisible();
			await expect(
				dialog.getByText(
					Content["connectors.datawrapper.missingScopesPanel.title"],
				),
			).toBeVisible();

			const scopeItem = dialog.getByRole("listitem").filter({
				hasText: "Chart: read",
			});

			if (isMobile) {
				// Mobile shows the details collapsed behind "Mehr lesen"
				await expect(scopeItem).toBeHidden();
				const showMore = dialog.getByRole("button", {
					name: Content["connectors.datawrapper.missingScopesPanel.showMore"],
				});
				await expect(showMore).toHaveAttribute("aria-expanded", "false");
				await showMore.click();
				await expect(
					dialog.getByRole("button", {
						name: Content["connectors.datawrapper.missingScopesPanel.showLess"],
					}),
				).toHaveAttribute("aria-expanded", "true");
			}

			await expect(scopeItem).toBeVisible();
			await expect(dialog.getByRole("listitem")).toHaveCount(
				REQUIRED_SCOPES.length,
			);
		},
	);

	testWithLoggedInUser(
		"shows a generic error when saving fails",
		async ({ page }) => {
			await mockIntegrationsApi(page, {
				saveResponse: { status: 500, body: { error: "Internal Server Error" } },
			});
			await page.goto("/profile/");

			await openConnectDialog(page);
			await submitToken(
				page,
				Content["connectors.datawrapper.tokenLabel"],
				VALID_TOKEN,
			);

			await expect(
				connectDialog(page)
					.getByRole("alert")
					.filter({ hasText: Content["connectors.datawrapper.error.generic"] }),
			).toBeVisible();
		},
	);

	testWithLoggedInUser(
		"replaces a stored token",
		async ({ page, isMobile }) => {
			const { savedKeys } = await mockIntegrationsApi(page, {
				integration: STORED_INTEGRATION,
			});
			await page.goto("/profile/");

			await expect(
				visibleText(page, formatMaskedToken(STORED_INTEGRATION.last4)),
			).toBeVisible();

			await chooseConnectedAction(page, isMobile, "edit");

			const dialog = connectDialog(page);
			await expect(dialog).toBeVisible();
			await expect(
				dialog.getByText(formatMaskedToken(STORED_INTEGRATION.last4)),
			).toBeVisible();

			await submitToken(
				page,
				Content["connectors.datawrapper.newTokenLabel"],
				VALID_TOKEN,
			);
			await expect(
				dialog.getByRole("heading", {
					name: Content["connectors.datawrapper.replaceSuccess.title"],
				}),
			).toBeVisible();
			expect(savedKeys).toEqual([VALID_TOKEN]);

			await dialog
				.getByRole("button", {
					name: Content["connectors.datawrapper.successContinueButton"],
				})
				.click();
			await expect(
				visibleText(page, formatMaskedToken(VALID_TOKEN.slice(-4))),
			).toBeVisible();
		},
	);

	testWithLoggedInUser(
		"disconnects a stored token",
		async ({ page, isMobile }) => {
			await mockIntegrationsApi(page, { integration: STORED_INTEGRATION });
			await page.goto("/profile/");

			await chooseConnectedAction(page, isMobile, "disconnect");

			const dialog = disconnectDialog(page);
			await expect(dialog).toBeVisible();
			await dialog
				.getByRole("button", {
					name: Content["connectors.datawrapper.disconnect.confirmButton"],
				})
				.click();
			await expect(dialog).toBeHidden();

			await expect(
				visibleText(page, formatMaskedToken(STORED_INTEGRATION.last4)),
			).toBeHidden();
			await expect(
				page.getByRole("button", {
					name: Content["connectors.datawrapper.connectButton"],
					exact: true,
				}),
			).toBeVisible();
		},
	);

	testWithLoggedInUser(
		"keeps the token and shows an error when disconnecting fails",
		async ({ page, isMobile }) => {
			await mockIntegrationsApi(page, {
				integration: STORED_INTEGRATION,
				deleteStatus: 500,
			});
			await page.goto("/profile/");

			await chooseConnectedAction(page, isMobile, "disconnect");

			const dialog = disconnectDialog(page);
			await dialog
				.getByRole("button", {
					name: Content["connectors.datawrapper.disconnect.confirmButton"],
				})
				.click();

			await expect(
				dialog.getByRole("alert").filter({
					hasText: Content["connectors.datawrapper.disconnect.error"],
				}),
			).toBeVisible();
			await expect(dialog).toBeVisible();
		},
	);

	testWithLoggedInUser(
		"closes the mobile action sheet without an action",
		async ({ page, isMobile }) => {
			testWithLoggedInUser.skip(!isMobile, "The action sheet is mobile only");

			await mockIntegrationsApi(page, { integration: STORED_INTEGRATION });
			await page.goto("/profile/");

			const menuButton = page.getByRole("button", {
				name: Content["connectors.datawrapper.menuButton.ariaLabel"],
			});
			const sheet = page.getByRole("dialog", {
				name: Content["connectors.datawrapper.sheet.title"],
			});

			await testWithLoggedInUser.step(
				"Close with the close button",
				async () => {
					await menuButton.click();
					await expect(sheet).toBeVisible();
					await sheet
						.getByRole("button", {
							name: Content["connectors.datawrapper.sheet.close.ariaLabel"],
						})
						.click();
					await expect(sheet).toBeHidden();
				},
			);

			await testWithLoggedInUser.step(
				"Close with Escape and return focus to the trigger",
				async () => {
					// Opened from the keyboard: WebKit doesn't focus buttons on tap,
					// so focus return is only meaningful for keyboard users
					await menuButton.focus();
					await page.keyboard.press("Enter");
					await expect(sheet).toBeVisible();
					await page.keyboard.press("Escape");
					await expect(sheet).toBeHidden();
					await expect(menuButton).toBeFocused();
				},
			);

			// Neither dialog opened
			await expect(connectDialog(page)).toBeHidden();
			await expect(disconnectDialog(page)).toBeHidden();
		},
	);
});
