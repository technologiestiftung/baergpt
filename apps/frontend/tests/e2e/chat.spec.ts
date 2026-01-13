import {
	mockDocumentUpload,
	uploadFileViaDragAndDrop,
} from "../fixtures/test-with-documents.ts";
import { expect, test } from "@playwright/test";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import {
	defaultDocumentName,
	defaultDocumentPath,
	secondaryDocumentName,
	secondaryDocumentPath,
	secondaryDocumentType,
} from "../constants.ts";
import { testDesktopOnly } from "../fixtures/test-desktop-only.ts";
import { supabaseAdminClient, supabaseAnonClient } from "../supabase.ts";

test.describe("Chat", () => {
	testWithLoggedInUser(
		"Chat without documents and copy answer",
		async ({ page, browserName }) => {
			await page.goto("/");

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			// Click the send button
			await page
				.getByRole("button", { name: "Ein weißer Pfeil nach rechts" })
				.click();

			// Wait for the AI response with a longer timeout since it involves backend API calls
			await page.waitForLoadState("networkidle");

			// Wait for the response to appear (2 markdown containers: question + answer)
			await expect(page.locator("div.markdown-container")).toHaveCount(2);

			// Verify the answer is not empty
			const markdownAnswer = page.locator("div.markdown-container").last();
			await expect(markdownAnswer).not.toBeEmpty();

			if (browserName === "webkit") {
				return;
			}

			await page.getByAltText("Kopieren").last().click();

			// Verify the answer is copied to clipboard
			const clipboardText = await page.evaluate(() =>
				navigator.clipboard.readText(),
			);
			expect(clipboardText).toBeDefined();
		},
	);

	testDesktopOnly("Chat with documents", async ({ page }) => {
		await page.goto("/");

		// Find the add-to-chat button for the specific document
		const addButton = page
			.getByRole("listitem")
			.filter({ hasText: defaultDocumentName })
			.getByLabel("Zum Chat hinzufügen");
		await expect(addButton).toBeVisible();

		// Click the add-to-chat button
		await addButton.click();

		// Verify the document is added to the chat
		await expect(page.getByText("1 Datei in diesem Chat")).toBeVisible();

		// Fill in the chat question
		await page
			.getByPlaceholder("Stellen Sie eine Frage")
			.fill("Worum geht es?");

		// Click the send button
		await page
			.getByRole("button", { name: "Ein weißer Pfeil nach rechts" })
			.click();

		// Wait for the response to appear (2 markdown containers: question + answer)
		// Use longer timeout since it involves backend API calls
		await expect(page.locator("div.markdown-container")).toHaveCount(2, {
			timeout: 60_000,
		});

		// Verify the answer is not empty
		const markdownAnswer = page.locator("div.markdown-container").last();
		await expect(markdownAnswer).not.toBeEmpty();
	});

	testDesktopOnly(
		"Add multiple documents / folders to chat",
		async ({ page }) => {
			const givenFolderName = "test-folder";

			await page.goto("/");

			await uploadFileViaDragAndDrop({
				page,
				fileName: secondaryDocumentName,
				filePath: secondaryDocumentPath,
				fileType: secondaryDocumentType,
			});

			// Create a new folder
			await page
				.getByRole("button", { name: "Neuer Ordner Plus-Icon" })
				.click();
			await page
				.getByRole("textbox", { name: "Ordner Name" })
				.fill(givenFolderName);
			await page
				.getByRole("button", { name: "Erstellen", exact: true })
				.click();

			// Verify the folder is created
			await expect(
				page.getByRole("listitem").filter({ hasText: givenFolderName }),
			).toBeVisible();

			// Add the folder and documents to the chat
			await page
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.getByLabel("Zum Chat hinzufügen")
				.click();
			await page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("Zum Chat hinzufügen")
				.click();
			await page
				.getByRole("listitem")
				.filter({ hasText: secondaryDocumentName })
				.getByLabel("Zum Chat hinzufügen")
				.click();

			await expect(
				page.getByRole("button", { name: "3 Elemente in diesem Chat" }),
			).toBeVisible();

			// Remove the folder from the chat
			await page.getByTestId(`remove-item-${givenFolderName}`).click();
			await page.getByTestId(`remove-item-${defaultDocumentName}`).click();
			await page.getByTestId(`remove-item-${secondaryDocumentName}`).click();

			// Verify the folder and documents are removed from the chat
			await expect(
				page.getByRole("button", { name: "Keine Dateien in diesem Chat" }),
			).toBeVisible();
		},
	);

	testDesktopOnly(
		"Chat with personal document citations",
		async ({ page, documentChunkId }) => {
			await page.goto("/");

			const content = `Das Dokument \\"UI Test Doc\\" enthält einen Platzhaltext (Lorem Ipsum).`;
			const citations = [documentChunkId];

			await page.route("**/llm/just-chatting", async (route) => {
				// Format as Server-Sent Events (SSE) stream
				const streamBody = [
					`data: ${JSON.stringify({ type: "text-delta", id: "1", delta: content })}\n\n`,
					`data: ${JSON.stringify({ type: "data-citations", data: citations })}\n\n`,
					`data: ${JSON.stringify({ type: "finish" })}\n\n`,
				].join("");

				await route.fulfill({
					status: 200,
					body: streamBody,
					headers: { "Content-Type": "text/event-stream; charset=utf-8" },
				});
			});

			// Find the add-to-chat button for the specific document
			const addButton = page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("Zum Chat hinzufügen");

			// Click the add-to-chat button
			await addButton.click();

			// Fill in the chat question
			await page
				.getByPlaceholder("Stellen Sie eine Frage")
				.fill("Worum geht es?");

			// Click the send button
			await page
				.getByRole("button", { name: "Ein weißer Pfeil nach rechts" })
				.click();

			// Wait for the citations button to appear (after stream finishes and citations are loaded)
			const allCitationsButton = page.getByRole("button", { name: "Quellen" });
			await expect(allCitationsButton).toBeVisible();

			await allCitationsButton.click();

			const citationsDialogHeader = page.getByRole("heading", {
				name: "Quellen",
			});
			await expect(citationsDialogHeader).toBeVisible();

			const citationDetail = page.getByRole("button", {
				name: "default_document.pdf Seite 1",
			});
			await expect(citationDetail).toBeVisible();

			const citationDialogClosingButton = page.getByTestId(
				/(close-citations-dialog-button-).+/,
			);
			await citationDialogClosingButton.click();

			await expect(citationsDialogHeader).not.toBeVisible();
		},
	);

	testDesktopOnly("Chat with public document citations", async ({ page }) => {
		// Create an admin user to upload the public document
		const adminEmail = "admin.test@local.berlin.de";
		const adminPassword = "TestPassword123!";
		let adminUserId: string | undefined;

		const { data: adminUserData, error: createAdminError } =
			await supabaseAdminClient.auth.admin.createUser({
				email: adminEmail,
				password: adminPassword,
				email_confirm: true,
				user_metadata: {
					first_name: "Admin",
					last_name: "Test",
				},
			});

		expect(createAdminError).toBeNull();

		if (createAdminError !== null) {
			throw createAdminError;
		}

		adminUserId = adminUserData.user.id;

		try {
			// Grant admin role by adding to application_admins table
			const { error: adminRoleError } = await supabaseAdminClient
				.from("application_admins")
				.insert({ user_id: adminUserId });

			expect(adminRoleError).toBeNull();

			// Sign in the admin user to get their access token
			const { data: adminSessionData, error: adminSignInError } =
				await supabaseAnonClient.auth.signInWithPassword({
					email: adminEmail,
					password: adminPassword,
				});

			expect(adminSignInError).toBeNull();

			if (adminSignInError !== null) {
				throw adminSignInError;
			}

			const adminAccessToken = adminSessionData.session.access_token;

			const { data: accessGroupData, error: accessGroupError } =
				await supabaseAdminClient
					.from("access_groups")
					.select()
					.eq("name", "Alle")
					.single();

			expect(accessGroupError).toBeNull();

			if (accessGroupError !== null) {
				throw accessGroupError;
			}

			const defaultAccessGroupId = accessGroupData.id;

			const publicDocumentChunkId = await mockDocumentUpload({
				userId: adminUserId,
				accessToken: adminAccessToken,
				accessGroupId: defaultAccessGroupId,
				fileName: defaultDocumentName,
				filePath: defaultDocumentPath,
				sourceType: "public_document",
				bucketName: "public_documents",
			});

			await page.goto("/");

			const content = `Das Dokument \\"UI Test Doc\\" enthält einen Platzhaltext (Lorem Ipsum).`;
			const citations = [publicDocumentChunkId];

			await page.route("**/llm/just-chatting", async (route) => {
				// Format as Server-Sent Events (SSE) stream
				const streamBody = [
					`data: ${JSON.stringify({ type: "text-delta", id: "1", delta: content })}\n\n`,
					`data: ${JSON.stringify({ type: "data-citations", data: citations })}\n\n`,
					`data: ${JSON.stringify({ type: "finish" })}\n\n`,
				].join("");

				await route.fulfill({
					status: 200,
					body: streamBody,
					headers: { "Content-Type": "text/event-stream; charset=utf-8" },
				});
			});

			// Find the add-to-chat button
			const addButton = page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("Zum Chat hinzufügen");

			// Click the add-to-chat button
			await addButton.click();

			// Fill in the chat question
			await page
				.getByPlaceholder("Stellen Sie eine Frage")
				.fill("Worum geht es?");

			// Click the send button
			await page
				.getByRole("button", { name: "Ein weißer Pfeil nach rechts" })
				.click();

			// Wait for the citations button to appear (after stream finishes and citations are loaded)
			const allCitationsButton = page.getByRole("button", { name: "Quellen" });
			await expect(allCitationsButton).toBeVisible();

			await allCitationsButton.click();

			const citationsDialogHeader = page.getByRole("heading", {
				name: "Quellen",
			});
			await expect(citationsDialogHeader).toBeVisible();

			const citationDetail = page.getByRole("button", {
				name: "default_document.pdf baer-",
			});
			await expect(citationDetail).toBeVisible();

			const publicDocumentPill = page
				.getByTestId("public-document-pill")
				.first();
			await expect(publicDocumentPill).toBeVisible();

			const citationDialogClosingButton = page.getByTestId(
				/(close-citations-dialog-button-).+/,
			);
			await citationDialogClosingButton.click();

			await expect(citationsDialogHeader).not.toBeVisible();
		} finally {
			if (adminUserId) {
				await supabaseAdminClient.auth.admin.deleteUser(adminUserId);
			}
		}
	});

	testWithLoggedInUser(
		"Export chat messages as Word and PDF document",
		async ({ page, isMobile, browserName }) => {
			// Skip this test on mobile
			test.skip(isMobile === true, "Skipping desktop tests on mobile");

			await page.goto("/");

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			// Click the send button
			await page
				.getByRole("button", { name: "Ein weißer Pfeil nach rechts" })
				.click();

			// Wait for the AI response with a longer timeout since it involves backend API calls
			await page.waitForLoadState("networkidle");

			// Wait for the response to appear (2 markdown containers: question + answer)
			await expect(page.locator("div.markdown-container")).toHaveCount(2);

			// Verify the answer is not empty
			const markdownAnswer = page.locator("div.markdown-container").last();
			await expect(markdownAnswer).not.toBeEmpty();

			if (browserName === "webkit") {
				return;
			}

			// Find the export button for the latest message
			const exportChatButton = page
				.locator('button[data-testid^="export-chat-message-button-"]')
				.last();
			await expect(exportChatButton).toBeVisible();

			// Click the export chat button
			await exportChatButton.click();

			// Find the docx export button corresponding to the same message (last one)
			const exportToDocxButton = page
				.locator('button[data-testid^="export-chat-message-docx-button-"]')
				.last();
			await expect(exportToDocxButton).toBeVisible();

			// Click the export button and wait for download
			const [downloadDocx] = await Promise.all([
				page.waitForEvent("download"),
				exportToDocxButton.click(),
			]);
			expect(downloadDocx).toBeTruthy();

			// Verify suggested filename matches expected format: dd.MM.yyyy - BärGPT Chat.docx
			const suggestedDocxFilename = downloadDocx.suggestedFilename();

			expect(suggestedDocxFilename).toMatch(/^\d{8}_\d{4}_BaerGPT-Chat\.docx$/);

			// Click the export chat button
			await exportChatButton.click();

			// Find the pdf export button corresponding to the same message (last one)
			const exportToPdfButton = page
				.locator('button[data-testid^="export-chat-message-pdf-button-"]')
				.last();
			await expect(exportToPdfButton).toBeVisible();

			// Click the export button and wait for download
			const [downloadPdf] = await Promise.all([
				page.waitForEvent("download"),
				exportToPdfButton.click(),
			]);

			expect(downloadPdf).toBeTruthy();

			// Verify suggested filename matches expected format: yyyyMMdd_HHmm_BaerGPT-Chat.pdf
			// Example: 20231005_1430_BaerGPT-Chat.pdf
			const suggestedFilename = downloadPdf.suggestedFilename();

			expect(suggestedFilename).toMatch(/^\d{8}_\d{4}_BaerGPT-Chat\.pdf$/);
		},
	);

	testDesktopOnly("Open / Close chat history", async ({ page }) => {
		await page.goto("/");

		// Check if the chat history is open
		await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();

		// Close the chat history
		await page.getByRole("button", { name: "Chat-Verlauf schließen" }).click();

		// Check if the chat history is closed
		await expect(
			page.getByRole("heading", { name: "Chats" }),
		).not.toBeVisible();

		// Open the chat history again
		await page.getByRole("button", { name: "Chat-Verlauf öffnen" }).click();

		// Check if the chat history is open again
		await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
	});

	testWithLoggedInUser(
		"Change LLM model from small to large and back",
		async ({ page }) => {
			await page.goto("/");

			// Check that the small LLM model is selected
			await expect(page.getByRole("button", { name: "Schnell" })).toBeVisible();

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			// Click the send button
			await page
				.getByRole("button", { name: "Ein weißer Pfeil nach rechts" })
				.click();

			// Wait for the AI response with a longer timeout since it involves backend API calls
			await page.waitForLoadState("networkidle");

			// Wait for the response to appear (2 markdown containers: question + answer)
			await expect(page.locator("div.markdown-container")).toHaveCount(2);

			// Verify the answer is not empty
			const markdownAnswerOne = page.locator("div.markdown-container").last();
			await expect(markdownAnswerOne).not.toBeEmpty();

			// Click on the LLM model button
			await page.getByRole("button", { name: "Schnell" }).click();

			// Select the large LLM model
			await page
				.getByRole("option", { name: "Mistral Large (präzise) auswählen" })
				.click();

			// Verify that the large LLM model is selected
			await expect(page.getByRole("button", { name: "Präzise" })).toBeVisible();

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			// Click the send button
			await page
				.getByRole("button", { name: "Ein weißer Pfeil nach rechts" })
				.click();

			// Wait for the AI response with a longer timeout since it involves backend API calls
			await page.waitForLoadState("networkidle");

			// Wait for the response to appear (4 markdown containers: question + answer)
			await expect(page.locator("div.markdown-container")).toHaveCount(4);

			// Verify the answer is not empty
			const markdownAnswerTwo = page.locator("div.markdown-container").last();
			await expect(markdownAnswerTwo).not.toBeEmpty();

			// Click on the LLM model button
			await page.getByRole("button", { name: "Präzise" }).click();

			// Verify that the model selection window is open
			await expect(page.getByText("Sprachmodell auswählen")).toBeVisible();

			// Select the small LLM model
			await page
				.getByRole("option", { name: "Mistral Small (schnell) auswählen" })
				.click();

			// Verify that the model selection window is closed after selecting a model
			await expect(page.getByText("Sprachmodell auswählen")).not.toBeVisible();

			// Verify that the small LLM model is selected
			await expect(page.getByRole("button", { name: "Schnell" })).toBeVisible();
		},
	);

	testDesktopOnly("Toggle base knowledge on and off", async ({ page }) => {
		await page.goto("/");

		// Find and click the chat options toggle button
		const chatOptionsButton = page.getByRole("button", {
			name: "Weitere Funktionen aktivieren",
		});
		await expect(chatOptionsButton).toBeVisible();

		// Click to open the dropdown
		await chatOptionsButton.click();

		// Verify the dropdown is open with the title "Wissen erweitern"
		await expect(page.getByText("Wissen erweitern")).toBeVisible();

		// Click on "Verwaltungswissen" option to toggle it on
		const baseKnowledgeOption = page.getByRole("button", {
			name: "Verwaltungswissen auswählen",
		});
		await expect(baseKnowledgeOption).toBeVisible();
		await baseKnowledgeOption.click();

		// Verify the dropdown closes after selection
		await expect(page.getByText("Wissen erweitern")).not.toBeVisible();

		// Verify the context pill appears with "Verwaltungswissen" label
		const contextPill = page.getByRole("button", {
			name: /Verwaltungswissen entfernen/,
		});
		await expect(contextPill).toBeVisible();

		// Click the context pill to toggle base knowledge off
		await contextPill.click();

		// Verify the context pill disappears
		await expect(contextPill).not.toBeVisible();

		// Toggle it back on via the dropdown to verify it works both ways
		await chatOptionsButton.click();
		await expect(page.getByText("Wissen erweitern")).toBeVisible();
		await baseKnowledgeOption.click();
		await expect(page.getByText("Wissen erweitern")).not.toBeVisible();

		// Verify the context pill appears again
		await expect(contextPill).toBeVisible();

		// Deselect base knowledge through the dropdown
		await chatOptionsButton.click();
		await expect(page.getByText("Wissen erweitern")).toBeVisible();

		// Click on "Verwaltungswissen" again to deselect it
		await baseKnowledgeOption.click();
		await expect(page.getByText("Wissen erweitern")).not.toBeVisible();

		// Verify the context pill disappears after deselecting through dropdown
		await expect(contextPill).not.toBeVisible();
	});
});
