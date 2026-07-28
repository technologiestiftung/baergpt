import { Readable } from "node:stream";
import {
	mockDocumentUpload,
	uploadFileViaDragAndDropAndWait,
} from "../fixtures/test-with-documents.ts";
import { expect, test } from "@playwright/test";
import {
	mockLlmCompletion,
	sendAndWaitForLLMResponse,
} from "../fixtures/mock-llm.ts";
import { testWithMockedLlm } from "../fixtures/test-with-mocked-llm.ts";
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
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";

test.describe("Chat", () => {
	testWithMockedLlm(
		"Chat without documents and copy answer",
		async ({ page, browserName }) => {
			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("hallo");

			await sendAndWaitForLLMResponse(page);

			const question = page.getByTestId("user-message-markdown-container");
			await expect(question).toBeVisible();

			if (browserName === "webkit") {
				return;
			}

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			await page.getByAltText("Kopieren").last().click();

			// Verify the answer is copied to clipboard
			const clipboardText = await page.evaluate(() =>
				navigator.clipboard.readText(),
			);
			expect(clipboardText).toBeDefined();
		},
	);

	testWithMockedLlm(
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
				hangingStream?.destroy();
			}
		},
	);

	testWithMockedLlm(
		"Copy text with markdown formatting as rich text and plain text",
		async ({ page, browserName }) => {
			await page.goto("/");

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("**hallo**");

			await sendAndWaitForLLMResponse(page);

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
		await expect(
			page.getByTestId(`remove-item-${defaultDocumentName}`),
		).toBeVisible();

		// Fill in the chat question
		await page
			.getByPlaceholder("Stellen Sie eine Frage")
			.fill("Worum geht es?");

		await sendAndWaitForLLMResponse(page);

		const question = page.getByTestId("user-message-markdown-container");
		await expect(question).toBeVisible();

		const answer = page.getByTestId("assistant-message-markdown-container");
		await expect(answer).not.toBeEmpty();
	});

	testDesktopOnly(
		"Add document and user folder to chat via dropdown",
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
			await expect(
				page.getByTestId(`remove-item-${defaultDocumentName}`),
			).toBeVisible();

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

			// Verify the folder and document are added to the chat
			await expect(
				page.getByTestId(`remove-item-${givenFolderName}`),
			).toBeVisible();
			await expect(
				page.getByTestId(`remove-item-${defaultDocumentName}`),
			).toBeVisible();
		},
	);

	testDesktopOnly(
		"Add multiple documents / folders to chat",
		async ({ page }) => {
			const givenFolderName = "test-folder";

			await page.goto("/");

			await uploadFileViaDragAndDropAndWait({
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

			await expect(
				page.getByTestId(`remove-item-${givenFolderName}`),
			).toBeVisible();
			await expect(
				page.getByTestId(`remove-item-${defaultDocumentName}`),
			).toBeVisible();
			await expect(
				page.getByTestId(`remove-item-${secondaryDocumentName}`),
			).toBeVisible();

			// Remove the folder from the chat
			await page.getByTestId(`remove-item-${givenFolderName}`).click();
			await page.getByTestId(`remove-item-${defaultDocumentName}`).click();
			await page.getByTestId(`remove-item-${secondaryDocumentName}`).click();

			// Verify the folder and documents are removed from the chat
			await expect(
				page.getByTestId(`remove-item-${givenFolderName}`),
			).not.toBeVisible();
			await expect(
				page.getByTestId(`remove-item-${defaultDocumentName}`),
			).not.toBeVisible();
			await expect(
				page.getByTestId(`remove-item-${secondaryDocumentName}`),
			).not.toBeVisible();
		},
	);

	testDesktopOnly(
		"Chat with personal document citations",
		async ({ page, documentChunkId }) => {
			await page.goto("/");

			const content = `Das Dokument \\"UI Test Doc\\" enthält einen Platzhaltext (Lorem Ipsum).`;
			const citations = [documentChunkId];

			await mockLlmCompletion(page, { textDelta: content, citations });

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

			await sendAndWaitForLLMResponse(page);

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
		const adminEmail = "admin.test@ts.berlin";
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

			await mockLlmCompletion(page, { textDelta: content, citations });

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

			await sendAndWaitForLLMResponse(page);

			// Wait for the citations button to appear (after stream finishes and citations are loaded)
			const allCitationsButton = page.getByRole("button", {
				name: "Quellen",
			});
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

	testDesktopOnly(
		"Export chat messages as Word and PDF document",
		async ({ page, browserName }) => {
			await page.goto("/");

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			await sendAndWaitForLLMResponse(page);

			const question = page.getByTestId("user-message-markdown-container");
			await expect(question).toBeVisible();

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

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

		const sidebar = page.getByRole("complementary", { name: "Sidebar" });

		const firstChatInHistory = sidebar.getByRole("button", {
			name: "Test Chat 30",
			exact: true,
		});

		await expect(firstChatInHistory).toBeVisible();

		const loadingSpinner = sidebar.getByTestId("load-more-chats-spinner");

		await expect(loadingSpinner).toBeVisible();

		resolveDeferredPromise();

		const lastChatInHistory = sidebar.getByRole("button", {
			name: "Test Chat 11",
			exact: true,
		});

		await lastChatInHistory.scrollIntoViewIfNeeded();

		await requestPromise;

		await expect(loadingSpinner).not.toBeVisible();

		const allChatsLoadedMessage = sidebar.getByText("Alle Chats geladen");

		await expect(allChatsLoadedMessage).toBeVisible();
	});

	testDesktopOnlyWithManyChats(
		"History - Group By - switches grouping to 'Datum' then switch grouping back to 'Keine'",
		async ({ page }) => {
			await page.goto("/");

			// Date-Groups should not be visible by default
			const dateGroupHeader = page
				.getByRole("complementary", { name: "Sidebar" })
				.getByTestId("history-date-group-label")
				.filter({ hasText: "Heute" });
			await expect(dateGroupHeader).not.toBeVisible();

			const groupByDropdown = page.getByRole("button", {
				name: "Dropdown-Menü zum Gruppieren von Chats",
			});
			await groupByDropdown.click();

			// "Keine" is default — it should have aria-checked="true"
			const noneOption = page.getByRole("menuitemradio", { name: "Keine" });
			await expect(noneOption).toHaveAttribute("aria-checked", "true");

			const dateOption = page.getByRole("menuitemradio", { name: "Datum" });
			await dateOption.click();

			// Dropdown closes after selection
			const openDropdownLabel = page.getByText("Gruppieren nach..");
			await expect(openDropdownLabel).not.toBeVisible();

			// At least one date group label should be visible (e.g. "Heute")
			await expect(dateGroupHeader).toBeVisible();

			// Reload to check localStorage persistence
			await page.reload();

			// check the preference is still active
			await expect(dateGroupHeader).toBeVisible();

			// Switch back to none
			await groupByDropdown.click();

			// The "Datum" option should now be selected
			await expect(dateOption).toHaveAttribute("aria-checked", "true");

			// Reset to "Keine"
			await noneOption.click();

			await expect(dateGroupHeader).not.toBeVisible();
		},
	);

	testWithMockedLlm(
		"Change LLM model from small to large and back",
		async ({ page }) => {
			await page.goto("/");

			// Check that the small LLM model is selected
			await expect(page.getByRole("button", { name: "Schnell" })).toBeVisible();

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			await sendAndWaitForLLMResponse(page);

			const question1 = page
				.getByTestId("user-message-markdown-container")
				.first();
			await expect(question1).toBeVisible();

			const answer1 = page
				.getByTestId("assistant-message-markdown-container")
				.first();
			await expect(answer1).not.toBeEmpty();

			// Click on the LLM model button
			await page.getByRole("button", { name: "Schnell" }).click();

			// Select the large LLM model
			await page
				.getByRole("option", { name: "Mistral Medium 3.5 (präzise) auswählen" })
				.click();

			// Verify that the large LLM model is selected
			await expect(page.getByRole("button", { name: "Präzise" })).toBeVisible();

			// Fill in the chat question
			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");

			await sendAndWaitForLLMResponse(page);

			const question2 = page
				.getByTestId("user-message-markdown-container")
				.last();
			await expect(question2).toBeVisible();

			const answer2 = page
				.getByTestId("assistant-message-markdown-container")
				.last();
			await expect(answer2).not.toBeEmpty();

			// Click on the LLM model button
			await page.getByRole("button", { name: "Präzise" }).click();

			// Verify that the model selection window is open
			await expect(page.getByText("Sprachmodell auswählen")).toBeVisible();

			// Select the small LLM model
			await page
				.getByRole("option", { name: "Mistral Small 4 (schnell) auswählen" })
				.click();

			// Verify that the model selection window is closed after selecting a model
			await expect(page.getByText("Sprachmodell auswählen")).not.toBeVisible();

			// Verify that the small LLM model is selected
			await expect(page.getByRole("button", { name: "Schnell" })).toBeVisible();
		},
	);

	testDesktopOnly(
		"Toggle base knowledge folder on and off",
		async ({ page }) => {
			await page.goto("/");

			await page.getByRole("button", { name: "In den Chat" }).first().click();

			const baseKnowledgeFolderInChat = page.getByTestId(
				"remove-item-Verwaltungswissen",
			);
			await expect(baseKnowledgeFolderInChat).toBeVisible();

			await baseKnowledgeFolderInChat.click();
			await expect(baseKnowledgeFolderInChat).not.toBeVisible();
		},
	);

	testDesktopOnly("Toggle Parla Berlin MCP", async ({ page }) => {
		const isMcpParlaAllowed =
			process.env.VITE_FEATURE_FLAG_MCP_PARLA_ALLOWED === "true";

		if (!isMcpParlaAllowed) {
			testDesktopOnly.skip();
		}

		await page.goto("/");

		// Open the chat options dropdown ("Wissen erweitern")
		const chatOptionsButton = page.getByRole("button", {
			name: "Weitere Funktionen aktivieren",
		});
		await expect(chatOptionsButton).toBeVisible();
		await chatOptionsButton.click();

		const connectorsOption = page.getByRole("menuitem", {
			name: "Konnektoren auswählen",
		});

		// Open the connectors submenu via hover
		await connectorsOption.hover();

		const connectorsSubmenu = page.getByTestId("chat-menu-connectors-submenu");
		await expect(connectorsSubmenu).toBeVisible();

		// locate the Parla Berlin option inside the submenu
		const parlaBerlinOption = connectorsSubmenu.getByRole("menuitemcheckbox", {
			name: /Parla Berlin/,
		});
		await expect(parlaBerlinOption).toBeVisible();

		if (process.env.VITE_FEATURE_FLAG_MCP_OPEN_DATA_ALLOWED === "true") {
			const openDataOption = connectorsSubmenu.getByRole("menuitemcheckbox", {
				name: /Berlin Open Data/,
			});
			await expect(openDataOption).toBeVisible();
		}

		// Select Parla Berlin and assert the check icon is visible
		// Assert the resulting context pill is visible
		const contextPill = page.getByRole("button", {
			name: /Parla Berlin entfernen/,
		});

		await test.step("Select Parla Berlin", async () => {
			await parlaBerlinOption.click();
			await expect(connectorsSubmenu).toBeHidden();
			await expect(contextPill).toBeVisible();
		});

		// Re-open the menu + submenu to verify the persisted "checked" state.
		await test.step("Re-opened submenu shows Parla Berlin as checked", async () => {
			await chatOptionsButton.click();
			await connectorsOption.hover();
			await expect(connectorsSubmenu).toBeVisible();
			await expect(parlaBerlinOption).toHaveAttribute("aria-checked", "true");
			await expect(
				parlaBerlinOption.getByAltText("Ein blaues Häkchen-Icon"),
			).toBeVisible();
		});

		// Toggling again in the submenu deselects it and closes the menu.
		await test.step("Deselect Parla Berlin", async () => {
			await parlaBerlinOption.click();
			await expect(connectorsSubmenu).toBeHidden();
			await expect(contextPill).not.toBeVisible();
			await expect(page.getByText("Parla Berlin")).not.toBeVisible();
		});
	});

	testDesktopOnly(
		"Activating web search shows privacy warning banner",
		async ({ page }) => {
			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testDesktopOnly.skip();
			}

			await page.goto("/");

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			await page
				.getByRole("menuitemcheckbox", { name: "Websuche auswählen" })
				.click();

			await expect(
				page.getByText(
					"Externe Datenquellen sind aktiv. Ihre Eingaben werden extern verarbeitet. Keine vertraulichen Daten eingeben.",
				),
			).toBeVisible();

			await page.getByRole("button", { name: "Websuche entfernen" }).click();

			await expect(
				page.getByText(
					"Externe Datenquellen sind aktiv. Ihre Eingaben werden extern verarbeitet. Keine vertraulichen Daten eingeben.",
				),
			).not.toBeVisible();
		},
	);

	testDesktopOnly(
		"Adding document while web search active deactivates web search",
		async ({ page }) => {
			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testDesktopOnly.skip();
			}
			await page.goto("/");

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			await page
				.getByRole("menuitemcheckbox", { name: "Websuche auswählen" })
				.click();

			const webSearchPill = page.getByRole("button", {
				name: "Websuche entfernen",
			});
			await expect(webSearchPill).toBeVisible();

			await page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("In den Chat")
				.click();

			await expect(webSearchPill).not.toBeVisible();

			await expect(
				page.getByText("Websuche wurde automatisch deaktiviert."),
			).toBeVisible();
		},
	);

	testDesktopOnly(
		"Adding folder while web search active deactivates web search",
		async ({ page }) => {
			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testDesktopOnly.skip();
			}
			const givenFolderName = "test-folder";

			await page.goto("/");

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

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			await page
				.getByRole("menuitemcheckbox", { name: "Websuche auswählen" })
				.click();

			const webSearchPill = page.getByRole("button", {
				name: "Websuche entfernen",
			});
			await expect(webSearchPill).toBeVisible();

			await page
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.getByLabel("In den Chat")
				.click();

			await expect(webSearchPill).not.toBeVisible();

			await expect(
				page.getByText("Websuche wurde automatisch deaktiviert."),
			).toBeVisible();
		},
	);

	testWithMockedLlm(
		"Activating web search shows chat history paused info message in a chat with history",
		async ({ page, isMobile }) => {
			testWithMockedLlm.skip(isMobile === true, "desktop-only menu flow");

			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testWithMockedLlm.skip();
			}

			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("Hallo, wie geht es dir?");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const historyScopedInfoMessage = page.getByText("Chatverlauf pausiert");
			await expect(historyScopedInfoMessage).toBeVisible();
		},
	);

	testWithMockedLlm(
		"Activating web search does not show chat history paused info message in a fresh chat",
		async ({ page, isMobile }) => {
			testWithMockedLlm.skip(isMobile === true, "desktop-only menu flow");

			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testWithMockedLlm.skip();
			}

			await page.goto("/");

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const chatInput = page.getByPlaceholder("Das Web durchsuchen");
			await expect(chatInput).toBeVisible();

			const historyScopedInfoMessage = page.getByText("Chatverlauf pausiert");
			await expect(historyScopedInfoMessage).not.toBeVisible();
		},
	);

	testWithMockedLlm(
		"Manually deactivating web search clears chat history paused info message",
		async ({ page, isMobile }) => {
			testWithMockedLlm.skip(isMobile === true, "desktop-only menu flow");

			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testWithMockedLlm.skip();
			}

			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("Hallo, wie geht es dir?");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const historyScopedInfoMessage = page.getByText("Chatverlauf pausiert");
			await expect(historyScopedInfoMessage).toBeVisible();

			const webSearchPill = page.getByRole("button", {
				name: "Websuche entfernen",
			});
			await webSearchPill.click();

			await expect(historyScopedInfoMessage).not.toBeVisible();
		},
	);

	testDesktopOnly(
		"Adding document replaces chat history paused info message with auto-deactivation info message",
		async ({ page }) => {
			if (process.env.VITE_FEATURE_FLAG_WEB_SEARCH_ALLOWED !== "true") {
				testDesktopOnly.skip();
			}

			await page.goto("/");

			const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
			await chatInput.fill("Hallo, wie geht es dir?");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			const chatOptionsButton = page.getByRole("button", {
				name: "Weitere Funktionen aktivieren",
			});
			await chatOptionsButton.click();

			const webSearchOption = page.getByRole("menuitemcheckbox", {
				name: "Websuche auswählen",
			});
			await webSearchOption.click();

			const historyScopedInfoMessage = page.getByText("Chatverlauf pausiert");
			await expect(historyScopedInfoMessage).toBeVisible();

			const addDocumentToChatButton = page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("In den Chat");
			await addDocumentToChatButton.click();

			const toolDeactivatedInfoMessage = page.getByText(
				"Websuche wurde automatisch deaktiviert.",
			);
			await expect(toolDeactivatedInfoMessage).toBeVisible();
			await expect(historyScopedInfoMessage).not.toBeVisible();
		},
	);

	testWithLoggedInUser(
		"Should not be able to send another message with enter while waiting for a response",
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
				const chatInput = page.getByPlaceholder("Stellen Sie eine Frage");
				await chatInput.fill("hallo123");

				const submitButton = page.getByRole("button", {
					name: "Nachricht senden",
				});
				await submitButton.click();

				const question = page.getByTestId("user-message-markdown-container");
				await expect(question).toBeVisible();

				const stopButton = page.getByRole("button", {
					name: "Textgenerierung stoppen",
				});
				await expect(stopButton).toBeVisible();

				const userMessages = page.getByTestId(
					"user-message-markdown-container",
				);
				const userMessageCountBefore = await userMessages.count();

				await chatInput.fill("hallo456");
				await chatInput.focus();

				await page.keyboard.press("Enter");

				await expect(userMessages).toHaveCount(userMessageCountBefore);
			} finally {
				await page.unroute("**/llm/just-chatting");
				hangingStream?.destroy();
			}
		},
	);

	testWithMockedLlm(
		"New message scrolls to top and scroll-to-bottom button works",
		async ({ page }) => {
			await page.goto("/");

			// A long answer so the conversation overflows the viewport, to
			// make the scroll-to-top behavior and the scroll button observable.
			const longAnswer = Array.from(
				{ length: 80 },
				(_, index) => `Absatz ${index + 1}: Lorem ipsum dolor sit amet.`,
			).join("\n\n");
			await mockLlmCompletion(page, { textDelta: longAnswer });

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			const answer = page.getByTestId("assistant-message-markdown-container");
			await expect(answer).not.toBeEmpty();

			const messagesContainer = page.getByRole("log");
			const question = page.getByTestId("user-message-markdown-container");

			// The freshly sent question should be pinned near the top of the
			// scrollable messages container rather than at the bottom.
			await expect
				.poll(async () => {
					const containerBox = await messagesContainer.boundingBox();
					const questionBox = await question.boundingBox();
					if (!containerBox || !questionBox) {
						return Number.POSITIVE_INFINITY;
					}
					return questionBox.y - containerBox.y;
				})
				.toBeLessThan(100);

			// Because the answer overflows, the scroll-to-bottom button is shown.
			const scrollToBottomButton = page.getByRole("button", {
				name: "Zum Ende des Chats scrollen",
			});
			await expect(scrollToBottomButton).toBeVisible();

			// Clicking it jumps to the bottom, which hides the button again.
			await scrollToBottomButton.click();
			await expect(scrollToBottomButton).toBeHidden();
		},
	);

	testWithMockedLlm(
		"Links in assistant messages open in new tab",
		async ({ page }) => {
			await page.goto("/");

			// Mock LLM to return a message with a link
			await mockLlmCompletion(page, {
				textDelta: "Check [this link](https://example.com) for details.",
			});

			await page.getByPlaceholder("Stellen Sie eine Frage").fill("hallo");
			await sendAndWaitForLLMResponse(page);

			const link = page
				.getByTestId("assistant-message-markdown-container")
				.locator("a");

			await expect(link).toHaveAttribute("target", "_blank");
			await expect(link).toHaveAttribute("rel", /(^|\s)noopener(\s|$)/);
			await expect(link).toHaveAttribute("rel", /(^|\s)noreferrer(\s|$)/);
		},
	);

	testDesktopOnly(
		"Web and Parla citations render together in the sources dialog",
		async ({ page }) => {
			await page.goto("/");

			// A single response carrying both web and Parla citations exercises the
			// multi-tool path where all citation types are preserved simultaneously.
			await mockLlmCompletion(page, {
				textDelta: "Antwort mit gemischten Quellen.",
				webCitations: [
					{
						url: "https://www.rbb24.de/berlin-baeume",
						title: "Berliner Stadtbäume 2026",
						snippet: "Aktuelle Zahlen zu Baumfällungen in Berlin.",
					},
				],
				parlaCitations: [
					{
						url: "https://parla.berlin/dokument-123",
						title: "Berliner Straßenbaumkonzept",
						source_type: "Drucksache",
						content: "Regelungen zur Pflanzung von Straßenbäumen.",
						page: 4,
					},
				],
			});

			await page
				.getByPlaceholder("Stellen Sie eine Frage")
				.fill("Bäume in Berlin?");
			await sendAndWaitForLLMResponse(page);

			const allCitationsButton = page.getByRole("button", { name: "Quellen" });
			await expect(allCitationsButton).toBeVisible();
			await allCitationsButton.click();

			// Both citation types are present in the same dialog.
			await expect(
				page.getByRole("link", { name: /Berliner Stadtbäume 2026/ }),
			).toBeVisible();
			await expect(
				page.getByRole("link", { name: /Berliner Straßenbaumkonzept/ }),
			).toBeVisible();
		},
	);
});
