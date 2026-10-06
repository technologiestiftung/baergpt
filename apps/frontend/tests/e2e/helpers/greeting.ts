import { expect, type Page } from "@playwright/test";

/**
 * The chat greeting phrase is picked at random from several variants, so tests
 * assert on the salutation inside the page heading instead of its full text.
 */
export const expectGreeting = async (page: Page, salutation: string) => {
	const heading = page.getByRole("heading", { level: 1 });
	await expect(heading).toBeVisible();
	await expect(heading).toContainText(salutation);
};
