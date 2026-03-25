import { Readable } from "node:stream";
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
import { testDesktopOnlyWithManyChats } from "../fixtures/test-desktop-only-with-many-chats.ts";

test.describe("Chat", () => {
	testWithLoggedInUser(
		"Chat without documents and copy answer",
		async ({ page, browserName }) => {
			await page.goto("/");

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			// Click the send button
			await page.getByRole("button", { name: "Nachricht senden" }).click();

			// Wait for the AI response with a longer timeout since it involves backend API calls
			await page.waitForLoadState("networkidle");

			const question = page.getByTestId("user-message-markdown-container");
			await expect(question).toBeVisible();

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

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

	testWithLoggedInUser(
		"Stop generating aborts stream without error banner",
		async ({ page }) => {
			await page.goto("/");
			let hangingStream: Readable | undefined;

			// Mock the LLM API to return a partial response
			await page.route("**/llm/just-chatting", async (route) => {
				hangingStream = new Readable({
					read() {},
				});
				hangingStream.push(
					`data: ${JSON.stringify({
						type: "text-delta",
						id: "1",
						delta: "Partial ",
					})}\n\n`,
				);

				await route.fulfill({
					status: 200,
					headers: {
						"Content-Type": "text/event-stream; charset=utf-8",
					},
					// @ts-expect-error Playwright Node accepts Readable for streaming bodies; public types omit it.
					body: hangingStream,
				});
			});

			try {
				await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
				await page.getByRole("button", { name: "Nachricht senden" }).click();

				const stopButton = page.getByRole("button", {
					name: "Textgenerierung stoppen",
				});
				await expect(stopButton).toBeVisible();

				await stopButton.click();

				await expect(
					page.getByText("Ihre Anfrage konnte gerade nicht bearbeitet werden."),
				).not.toBeVisible();

				await expect(
					page.getByRole("button", { name: "Nachricht senden" }),
				).toBeVisible();
			} finally {
				await page.unroute("**/llm/just-chatting");
				hangingStream?.destroy();
			}
		},
	);

	testWithLoggedInUser(
		"Copy text with markdown formatting as rich text and plain text",
		async ({ page, browserName }) => {
			await page.goto("/");

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("**hallo**");

			// Click the send button
			await page.getByRole("button", { name: "Nachricht senden" }).click();

			if (browserName === "webkit") {
				return;
			}

			// Copy user message with markdown formatting
			await page.getByAltText("Kopieren").first().click();

			// Wait for clipboard write to complete
			await page.waitForTimeout(100);

			// Verify the answer is copied to clipboard
			const clipboardContent = await page.evaluate(async () => {
				const types = await navigator.clipboard.read();
				const type = types[0];
				const htmlBlob = await type.getType("text/html");
				const plainBlob = await type.getType("text/plain");
				return {
					html: await htmlBlob.text(),
					plain: await plainBlob.text(),
				};
			});

			// Verify text/html contains HTML bold tags and not markdown **
			expect(clipboardContent.html).toContain("<strong>hallo</strong>");
			expect(clipboardContent.html).not.toContain("**");

			// Verify text/plain contains markdown ** syntax
			expect(clipboardContent.plain).toContain("**hallo**");
		},
	);

	testDesktopOnly("Chat with documents", async ({ page }) => {
		await page.goto("/");

		// Find the add-to-chat button for the specific document
		const addButton = page
			.getByRole("listitem")
			.filter({ hasText: defaultDocumentName })
			.getByLabel("In den Chat");
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
		await page.getByRole("button", { name: "Nachricht senden" }).click();

		const question = page.getByTestId("user-message-markdown-container");
		await expect(question).toBeVisible();

		const answer = page.getByTestId("assistant-message-markdown-container");
		await expect(answer).not.toBeEmpty({ timeout: 60_000 });
	});

	testDesktopOnly(
		"Add document and folder to chat via dropdown",
		async ({ page }) => {
			const givenFolderName = "test-folder";

			await page.goto("/");

			const menuButtonDocument = page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("Menü öffnen");
			await expect(menuButtonDocument).toBeVisible();

			await menuButtonDocument.click();

			// Expect add to chat button in dropdown to be visible and click it
			await expect(
				page.getByRole("option", { name: "In den Chat" }),
			).toBeVisible();
			await page.getByRole("option", { name: "In den Chat" }).click();

			// Verify the document is added to the chat
			await expect(page.getByText("1 Datei in diesem Chat")).toBeVisible();

			// Create a new folder
			await page
				.getByRole("button", { name: "Ordner-Icon Ordner erstellen" })
				.click();
			await page
				.getByRole("textbox", { name: "Neuer Ordner" })
				.fill(givenFolderName);
			await page
				.getByRole("button", { name: "Erstellen", exact: true })
				.click();

			// Verify the folder is created
			await expect(
				page.getByRole("listitem").filter({ hasText: givenFolderName }),
			).toBeVisible();

			// Add the folder and documents to the chat
			const menuButtonFolder = page
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.getByLabel("Menü öffnen");
			await expect(menuButtonFolder).toBeVisible();
			await menuButtonFolder.click();

			// Expect add to chat button in dropdown to be visible and click it
			await expect(
				page.getByRole("option", { name: "In den Chat" }),
			).toBeVisible();
			await page.getByRole("option", { name: "In den Chat" }).click();

			// Verify the folder is added to the chat
			await expect(page.getByText("2 Elemente in diesem Chat")).toBeVisible();
		},
	);

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
				.getByRole("button", { name: "Ordner-Icon Ordner erstellen" })
				.click();
			await page
				.getByRole("textbox", { name: "Neuer Ordner" })
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
				.getByLabel("In den Chat")
				.click();
			await page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("In den Chat")
				.click();
			await page
				.getByRole("listitem")
				.filter({ hasText: secondaryDocumentName })
				.getByLabel("In den Chat")
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
				page.getByRole("button", { name: "3 Elemente in diesem Chat" }),
			).not.toBeVisible();
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
				.getByLabel("In den Chat");

			// Click the add-to-chat button
			await addButton.click();

			// Fill in the chat question
			await page
				.getByPlaceholder("Stellen Sie eine Frage")
				.fill("Worum geht es?");

			// Click the send button
			await page.getByRole("button", { name: "Nachricht senden" }).click();

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

		const adminUserId = adminUserData.user.id;

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
				.getByLabel("In den Chat");

			// Click the add-to-chat button
			await addButton.click();

			// Fill in the chat question
			await page
				.getByPlaceholder("Stellen Sie eine Frage")
				.fill("Worum geht es?");

			// Click the send button
			await page.getByRole("button", { name: "Nachricht senden" }).click();

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
			await page.getByRole("button", { name: "Nachricht senden" }).click();

			const question = page.getByTestId("user-message-markdown-container");
			await expect(question).toBeVisible();

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty({ timeout: 60_000 });

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

	testDesktopOnlyWithManyChats("Chat history loading", async ({ page }) => {
		const isNextChatsPageRequest = (url: URL) =>
			url.pathname.includes("/rest/v1/chats") &&
			url.searchParams.get("offset") === "20";

		const createDeferredPromise = () => {
			let resolveDeferredPromise: (value?: unknown) => void = () => {};
			const deferredPromise = new Promise((resolve) => {
				resolveDeferredPromise = resolve;
			});
			return { deferredPromise, resolveDeferredPromise };
		};

		const { deferredPromise, resolveDeferredPromise } = createDeferredPromise();

		const requestPromise = page.route(isNextChatsPageRequest, async (route) => {
			await deferredPromise;
			await route.continue();
		});

		await page.goto("/");

		const firstChatInHistory = page
			.getByRole("complementary")
			.locator("div")
			.filter({ hasText: /^Test Chat 30$/ });

		await expect(firstChatInHistory).toBeVisible();

		const loadingSpinner = page
			.getByRole("complementary", { name: "Sidebar" })
			.getByTestId("load-more-chats-spinner");

		await expect(loadingSpinner).toBeVisible();

		resolveDeferredPromise();

		const lastChatInHistory = page
			.getByRole("complementary")
			.locator("div")
			.filter({ hasText: /^Test Chat 11$/ });

		await lastChatInHistory.scrollIntoViewIfNeeded();

		await requestPromise;

		await expect(loadingSpinner).not.toBeVisible();

		const allChatsLoadedMessage = page
			.getByRole("complementary")
			.getByText("Alle Chats geladen");

		await expect(allChatsLoadedMessage).toBeVisible();
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
			await page.getByRole("button", { name: "Nachricht senden" }).click();

			const question1 = page
				.getByTestId("user-message-markdown-container")
				.first();
			await expect(question1).toBeVisible();

			const answer1 = page
				.getByTestId("assistant-message-markdown-container")
				.first();
			await expect(answer1).not.toBeEmpty({ timeout: 60_000 });

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
			await page.getByRole("button", { name: "Nachricht senden" }).click();

			// Wait for the AI response with a longer timeout since it involves backend API calls
			await page.waitForLoadState("networkidle");

			const question2 = page
				.getByTestId("user-message-markdown-container")
				.last();
			await expect(question2).toBeVisible();

			const answer2 = page
				.getByTestId("assistant-message-markdown-container")
				.last();
			await expect(answer2).not.toBeEmpty({ timeout: 60_000 });

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

		// Verify the baseKnowledge Pill is visible by default
		const baseKnowledgePill = page.getByRole("button", {
			name: /Verwaltungswissen entfernen/,
		});
		await expect(baseKnowledgePill).toBeVisible();

		// Verify the baseKnowledge Pill is not visible after clicking to remove
		await baseKnowledgePill.click();
		await expect(baseKnowledgePill).not.toBeVisible();

		// Click to open the dropdown
		await chatOptionsButton.click();

		// Verify the dropdown is open with the title "Wissen erweitern"
		await expect(page.getByText("Wissen erweitern")).toBeVisible();

		// Click on "Verwaltungswissen" option to toggle it on
		const baseKnowledgeOption = page.getByRole("option", {
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

		// Deselect base knowledge through the dropdown
		await chatOptionsButton.click();
		await expect(page.getByText("Wissen erweitern")).toBeVisible();

		// Click on "Verwaltungswissen" again to deselect it
		await baseKnowledgeOption.click();
		await expect(page.getByText("Wissen erweitern")).not.toBeVisible();

		// Verify the context pill disappears after deselecting through dropdown
		await expect(contextPill).not.toBeVisible();
	});

	testDesktopOnly("Toggle Parla Berlin MCP", async ({ page }) => {
		await page.goto("/");

		// Open the chat options dropdown ("Wissen erweitern")
		const chatOptionsButton = page.getByRole("button", {
			name: "Weitere Funktionen aktivieren",
		});
		await expect(chatOptionsButton).toBeVisible();
		await chatOptionsButton.click();

		const mcpServerOption = page.getByRole("option", {
			name: "MCP Server auswählen",
		});

		// Skip when MCP is disabled via VITE_FEATURE_FLAG_MCP_PARLA_ALLOWED
		await test.step("Skip when MCP Server option is not available (feature flag off)", async () => {
			if (!(await mcpServerOption.isVisible())) {
				test.skip(
					true,
					"MCP Server option not available (VITE_FEATURE_FLAG_MCP_PARLA_ALLOWED is not enabled)",
				);
			}
		});

		// Open the MCP server selection dialog
		await mcpServerOption.click();

		const mcpDialog = page.locator("#mcp-options-dialog");
		await expect(mcpDialog).toBeVisible();

		// locate the Parla Berlin option inside the dialog
		const parlaBerlinOption = mcpDialog.getByRole("button", {
			name: /Parla Berlin/,
		});
		await expect(parlaBerlinOption).toBeVisible();
		await expect(
			mcpDialog.getByText("Schriftliche Anfragen des Abgh. Berlins"),
		).toBeVisible();

		// Select Parla Berlin and assert the check icon is visible
		await test.step("Select Parla Berlin", async () => {
			await parlaBerlinOption.click();
			await expect(
				parlaBerlinOption.getByAltText("Ein blaues Häkchen-Icon"),
			).toBeVisible();
		});

		// Deselect Parla Berlin in the dialog and assert the check icon is hidden
		await test.step("Deselect Parla Berlin", async () => {
			await parlaBerlinOption.click();
			await expect(
				parlaBerlinOption.getByAltText("Ein blaues Häkchen-Icon"),
			).toBeHidden();
		});

		// Close the MCP options dialog
		await test.step("Close MCP options dialog", async () => {
			await page.getByTestId("mcp-options-dialog-close").click();
			await expect(mcpDialog).not.toBeVisible();
		});

		// Re-select Parla Berlin via the dialog to verify the context pill
		await chatOptionsButton.click();
		await mcpServerOption.click();
		await parlaBerlinOption.click();
		await page.getByTestId("mcp-options-dialog-close").click();

		// Verify the context pill appears with "Parla Berlin entfernen" (remove option)
		const contextPill = page.getByRole("button", {
			name: /Parla Berlin entfernen/,
		});
		await expect(contextPill).toBeVisible();

		// Deselect by clicking the pill; pill and label should disappear
		await contextPill.click();
		await expect(page.getByText("Parla Berlin")).not.toBeVisible();
		await expect(contextPill).not.toBeVisible();
	});

	testDesktopOnly(
		"Disabling base knowledge should re-activate it when swapping between two chats",
		async ({ page }) => {
			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("hallo");

			const sendButton = page.getByRole("button", {
				name: "Nachricht senden",
			});
			await sendButton.click();

			await page.waitForLoadState("networkidle");

			const baseKnowledgePill = page.getByRole("button", {
				name: /Verwaltungswissen entfernen/,
			});
			await baseKnowledgePill.click();

			await expect(baseKnowledgePill).not.toBeVisible();

			const startNewChatButton = page.getByRole("button", {
				name: "Neuen Chat erstellen",
			});
			await startNewChatButton.click();

			await expect(baseKnowledgePill).toBeVisible();
		},
	);

	testDesktopOnly(
		"Disabling base knowledge should not re-activate it when starting the first chat",
		async ({ page }) => {
			await page.goto("/");

			// Disable the base knowledge feature
			const baseKnowledgePill = page.getByRole("button", {
				name: /Verwaltungswissen entfernen/,
			});
			await baseKnowledgePill.click();

			// Start a new chat by asking a question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			// Click the send button
			await page.getByRole("button", { name: "Nachricht senden" }).click();

			await page.waitForLoadState("networkidle");

			await expect(baseKnowledgePill).not.toBeVisible();
		},
	);
});
