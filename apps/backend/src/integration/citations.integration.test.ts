import {
	afterEach,
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { serviceRoleDbClient } from "../supabase";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../config";
import {
	content as snippet,
	defaultDocumentName,
	defaultDocumentPath,
} from "./fixtures/constants";
import { cleanupDocuments, mockDocumentUpload } from "./fixtures/documents";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("Integration tests for Citations", () => {
	const givenAdminId = "d18922bb-7f9a-4e15-a9c9-6788fe81842c";
	const givenAdminEmail = "db-test-suite-admin@local.berlin.de";
	const givenAdminPassword = "SecurePassword123!";

	const givenUserId = "73f1b859-1377-4f72-ac92-ea28b1fb5167";
	const givenUserEmail = "db-test-suite-user@local.berlin.de";
	const givenUserPassword = "SecurePassword123!";

	let accessGroupId: string;

	const users = [
		{
			id: givenAdminId,
			email: givenAdminEmail,
			password: givenAdminPassword,
		},
		{ id: givenUserId, email: givenUserEmail, password: givenUserPassword },
	];

	beforeAll(async () => {
		// Fetch access group ID
		const { data: accessGroupData } = await serviceRoleDbClient
			.from("access_groups")
			.select("id")
			.eq("name", "Alle")
			.single();

		if (!accessGroupData) {
			throw new Error("Default access group not found");
		}

		accessGroupId = accessGroupData.id;

		// Clean up any leftover users from previous interrupted test runs
		for (const user of users) {
			await serviceRoleDbClient.auth.admin.deleteUser(user.id);
		}

		for (const user of users) {
			const { error: signupError } =
				await serviceRoleDbClient.auth.admin.createUser({
					id: user.id,
					email: user.email,
					password: user.password,
					email_confirm: true,
				});

			expect(signupError).toBeNull();
		}

		const { error: setAdminError } = await serviceRoleDbClient
			.from("application_admins")
			.insert({ user_id: givenAdminId });

		expect(setAdminError).toBeNull();
	});

	afterEach(async () => {
		await supabaseAnonClient.auth.signOut();
	});

	afterAll(async () => {
		for (const { id } of users) {
			const { error: deleteError } =
				await serviceRoleDbClient.auth.admin.deleteUser(id);
			expect(deleteError).toBeNull();
		}
	});

	describe("get_citation_details", () => {
		let givenChatId: number;
		let givenMessageId: number;

		beforeEach(async () => {
			const { data: chatData } = await serviceRoleDbClient
				.from("chats")
				.insert({ user_id: givenAdminId, name: "Citation Test Chat" })
				.select("id")
				.single();
			if (!chatData) {
				throw new Error("Chat creation failed");
			}
			givenChatId = chatData.id;

			const { data: messageData } = await serviceRoleDbClient
				.from("chat_messages")
				.insert({
					chat_id: givenChatId,
					role: "assistant",
					content: "test",
					type: "text",
				})
				.select("id")
				.single();
			if (!messageData) {
				throw new Error("Message creation failed");
			}
			givenMessageId = messageData.id;
		});

		afterEach(async () => {
			await serviceRoleDbClient.from("chats").delete().eq("id", givenChatId);
		});

		describe("personal documents", () => {
			let givenChunkId: number;

			beforeEach(async () => {
				givenChunkId = await mockDocumentUpload({
					userId: givenAdminId,
					accessGroupId: null,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
					sourceType: "personal_document",
					bucketName: "documents",
					userEmail: givenAdminEmail,
					userPassword: givenAdminPassword,
				});
			});

			afterEach(async () => await cleanupDocuments(givenAdminId));

			it("should return citation details for an self-owned document", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: givenMessageId,
						document_chunk_ids: [givenChunkId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				const { data: citationDetails } = await supabaseAnonClient.rpc(
					"get_citation_details",
					{
						citation_ids: [citationRow.id],
					},
				);

				if (!citationDetails) {
					throw new Error("Citation details are undefined");
				}

				const expectedCitationDetails = {
					citation_id: citationRow.id,
					file_name: defaultDocumentName,
					source_url: `${givenAdminId}/${defaultDocumentName}`,
					page: 1,
					source_type: "personal_document",
					snippet,
				};

				expect(citationDetails[0]).toMatchObject(expectedCitationDetails);
			});

			it("should return no citation details for a not self-owned document", async () => {
				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: givenMessageId,
						document_chunk_ids: [givenChunkId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
					"get_citation_details",
					{
						citation_ids: [citationRow.id],
					},
				);

				expect(actualCitationDetails).toMatchObject([]);
			});
		});

		describe("public documents", () => {
			let givenChunkId: number;

			beforeEach(async () => {
				givenChunkId = await mockDocumentUpload({
					userId: givenAdminId,
					accessGroupId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
					sourceType: "public_document",
					bucketName: "public_documents",
					userEmail: givenAdminEmail,
					userPassword: givenAdminPassword,
				});
			});

			afterEach(async () => await cleanupDocuments(givenAdminId));

			it("should return citation details for a (self-owned) public document", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: givenMessageId,
						document_chunk_ids: [givenChunkId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
					"get_citation_details",
					{
						citation_ids: [citationRow.id],
					},
				);

				const expectedCitationDetails = [
					{
						citation_id: citationRow.id,
						file_name: defaultDocumentName,
						source_url: `${accessGroupId}/${defaultDocumentName}`,
						page: 1,
						source_type: "public_document",
						snippet,
					},
				];

				expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
			});

			it("should return citation details for a (not self-owned) public document", async () => {
				const { data: userChat } = await serviceRoleDbClient
					.from("chats")
					.insert({ user_id: givenUserId, name: "User Citation Chat" })
					.select("id")
					.single();
				if (!userChat) {
					throw new Error("User chat creation failed");
				}

				const { data: userMessage } = await serviceRoleDbClient
					.from("chat_messages")
					.insert({
						chat_id: userChat.id,
						role: "assistant",
						content: "test",
						type: "text",
					})
					.select("id")
					.single();
				if (!userMessage) {
					throw new Error("User message creation failed");
				}

				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: userMessage.id,
						document_chunk_ids: [givenChunkId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				const { error: signInError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});

				expect(signInError).toBeNull();

				const { data: actualCitationDetails, error } =
					await supabaseAnonClient.rpc("get_citation_details", {
						citation_ids: [citationRow.id],
					});
				expect(error).toBeNull();

				const expectedCitationDetails = [
					{
						citation_id: citationRow.id,
						file_name: defaultDocumentName,
						source_url: `${accessGroupId}/${defaultDocumentName}`,
						page: 1,
						source_type: "public_document",
						snippet,
					},
				];

				expect(actualCitationDetails).toMatchObject(expectedCitationDetails);

				await serviceRoleDbClient.from("chats").delete().eq("id", userChat.id);
			});
		});

		describe("default documents", () => {
			let givenChunkId: number;

			beforeEach(async () => {
				givenChunkId = await mockDocumentUpload({
					userId: givenAdminId,
					accessGroupId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
					sourceType: "default_document",
					bucketName: "public_documents",
					userEmail: givenAdminEmail,
					userPassword: givenAdminPassword,
				});
			});

			afterEach(async () => await cleanupDocuments(givenAdminId));

			it("should return citation details for a (self-owned) default document", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: givenMessageId,
						document_chunk_ids: [givenChunkId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
					"get_citation_details",
					{
						citation_ids: [citationRow.id],
					},
				);

				const expectedCitationDetails = [
					{
						citation_id: citationRow.id,
						file_name: defaultDocumentName,
						source_url: `${accessGroupId}/${defaultDocumentName}`,
						page: 1,
						source_type: "default_document",
						snippet,
					},
				];

				expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
			});

			it("should return citation details for a (not self-owned) default document", async () => {
				const { data: userChat } = await serviceRoleDbClient
					.from("chats")
					.insert({ user_id: givenUserId, name: "User Citation Chat" })
					.select("id")
					.single();
				if (!userChat) {
					throw new Error("User chat creation failed");
				}

				const { data: userMessage } = await serviceRoleDbClient
					.from("chat_messages")
					.insert({
						chat_id: userChat.id,
						role: "assistant",
						content: "test",
						type: "text",
					})
					.select("id")
					.single();
				if (!userMessage) {
					throw new Error("User message creation failed");
				}

				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: userMessage.id,
						document_chunk_ids: [givenChunkId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				const { error: signInError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});

				expect(signInError).toBeNull();

				const { data: actualCitationDetails, error } =
					await supabaseAnonClient.rpc("get_citation_details", {
						citation_ids: [citationRow.id],
					});
				expect(error).toBeNull();

				const expectedCitationDetails = [
					{
						citation_id: citationRow.id,
						file_name: defaultDocumentName,
						source_url: `${accessGroupId}/${defaultDocumentName}`,
						page: 1,
						source_type: "default_document",
						snippet,
					},
				];

				expect(actualCitationDetails).toMatchObject(expectedCitationDetails);

				await serviceRoleDbClient.from("chats").delete().eq("id", userChat.id);
			});
		});

		describe("external citations", () => {
			const givenExternalCitationId = "parla-test-citation-001";
			const givenExternalSnippet = "Berliner Verwaltung Testinhalt";
			const givenExternalPage = 3;
			const givenExternalFileName = "parla-document.pdf";
			const givenExternalSourceUrl =
				"https://pardok.parlament-berlin.de/test-doc";

			afterEach(async () => {
				await serviceRoleDbClient
					.from("external_citations")
					.delete()
					.eq("id", givenExternalCitationId);
			});

			it("should return citation details for an external citation", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { error: externalCitationError } = await serviceRoleDbClient
					.from("external_citations")
					.insert({
						id: givenExternalCitationId,
						snippet: givenExternalSnippet,
						page: givenExternalPage,
						file_name: givenExternalFileName,
						source_url: givenExternalSourceUrl,
						created_at: new Date().toISOString(),
						source_type: "parla_document",
					});
				expect(externalCitationError).toBeNull();

				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: givenMessageId,
						external_citation_ids: [givenExternalCitationId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				const { data: actualCitationDetails, error } =
					await supabaseAnonClient.rpc("get_citation_details", {
						citation_ids: [citationRow.id],
					});
				expect(error).toBeNull();

				const expectedCitationDetails = [
					{
						citation_id: citationRow.id,
						file_name: givenExternalFileName,
						source_url: givenExternalSourceUrl,
						page: givenExternalPage,
						source_type: "parla_document",
						snippet: givenExternalSnippet,
					},
				];

				expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
			});

			it("should return no external citation details for a non-owner user", async () => {
				const { error: externalCitationError } = await serviceRoleDbClient
					.from("external_citations")
					.insert({
						id: givenExternalCitationId,
						snippet: givenExternalSnippet,
						page: givenExternalPage,
						file_name: givenExternalFileName,
						source_url: givenExternalSourceUrl,
						created_at: new Date().toISOString(),
						source_type: "parla_document",
					});
				expect(externalCitationError).toBeNull();

				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: givenMessageId,
						external_citation_ids: [givenExternalCitationId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
					"get_citation_details",
					{
						citation_ids: [citationRow.id],
					},
				);

				expect(actualCitationDetails).toMatchObject([]);
			});

			it("should return mixed citation details for document chunks and external citations", async () => {
				const givenChunkId = await mockDocumentUpload({
					userId: givenAdminId,
					accessGroupId: null,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
					sourceType: "personal_document",
					bucketName: "documents",
					userEmail: givenAdminEmail,
					userPassword: givenAdminPassword,
				});

				const { error: externalCitationError } = await serviceRoleDbClient
					.from("external_citations")
					.insert({
						id: givenExternalCitationId,
						snippet: givenExternalSnippet,
						page: givenExternalPage,
						file_name: givenExternalFileName,
						source_url: givenExternalSourceUrl,
						created_at: new Date().toISOString(),
						source_type: "parla_document",
					});
				expect(externalCitationError).toBeNull();

				// Insert single row with both document chunks and external citations
				const { data: citationRow } = await serviceRoleDbClient
					.from("chat_message_citations")
					.insert({
						message_id: givenMessageId,
						document_chunk_ids: [givenChunkId],
						external_citation_ids: [givenExternalCitationId],
					})
					.select("id")
					.single();
				if (!citationRow) {
					throw new Error("Citation creation failed");
				}

				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { data: actualCitationDetails, error } =
					await supabaseAnonClient.rpc("get_citation_details", {
						citation_ids: [citationRow.id],
					});
				expect(error).toBeNull();
				expect(actualCitationDetails).toHaveLength(2);

				// Both citations should have the same citation_id (the row ID)
				const chunkCitation = actualCitationDetails?.find(
					(citation: { file_name?: string }) =>
						citation.file_name === defaultDocumentName,
				);
				expect(chunkCitation).toMatchObject({
					citation_id: citationRow.id,
					file_name: defaultDocumentName,
					source_type: "personal_document",
					snippet,
				});

				const externalCitation = actualCitationDetails?.find(
					(citation: { file_name?: string }) =>
						citation.file_name === givenExternalFileName,
				);
				expect(externalCitation).toMatchObject({
					citation_id: citationRow.id,
					file_name: givenExternalFileName,
					source_url: givenExternalSourceUrl,
					source_type: "parla_document",
					snippet: givenExternalSnippet,
				});

				await cleanupDocuments(givenAdminId);
			});
		});

		describe("when message has no citations", () => {
			it("should return no citation details", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
					"get_citation_details",
					{
						citation_ids: [],
					},
				);

				const expectedCitationDetails: unknown[] = [];

				expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
			});
		});
	});

	describe("chat_message_citations RLS policies", () => {
		let userChatId: number;
		let userMessageId: number;

		beforeEach(async () => {
			// Sign in as user
			await supabaseAnonClient.auth.signInWithPassword({
				email: givenUserEmail,
				password: givenUserPassword,
			});

			// Create a chat for the user
			const { data: chatData, error: chatError } = await supabaseAnonClient
				.from("chats")
				.insert({
					name: "Test Chat",
					user_id: givenUserId,
				})
				.select("id")
				.single();

			if (chatError) {
				throw chatError;
			}
			userChatId = chatData.id;

			// Create a message for the user
			const { data: messageData, error: messageError } =
				await supabaseAnonClient
					.from("chat_messages")
					.insert({
						chat_id: userChatId,
						role: "user",
						content: "Test message",
						type: "text",
					})
					.select("id")
					.single();

			if (messageError) {
				throw messageError;
			}
			userMessageId = messageData.id;
		});

		afterEach(async () => {
			if (userChatId) {
				await serviceRoleDbClient.from("chats").delete().eq("id", userChatId);
			}
		});

		it("should allow a user to insert citations for their own message", async () => {
			const { error } = await supabaseAnonClient
				.from("chat_message_citations")
				.insert({
					message_id: userMessageId,
					external_citation_ids: ["test-citation-1"],
				});
			expect(error).toBeNull();
		});

		it("should allow a user to delete citations for their own message", async () => {
			const { data: citation, error: insertError } = await supabaseAnonClient
				.from("chat_message_citations")
				.insert({
					message_id: userMessageId,
					external_citation_ids: ["test-citation-2"],
				})
				.select("id")
				.single();
			expect(insertError).toBeNull();
			if (!citation) {
				throw new Error("Citation creation failed");
			}

			const { error: deleteError } = await supabaseAnonClient
				.from("chat_message_citations")
				.delete()
				.eq("id", citation.id);
			expect(deleteError).toBeNull();

			// Verify deletion
			const { count } = await serviceRoleDbClient
				.from("chat_message_citations")
				.select("*", { count: "exact", head: true })
				.eq("id", citation.id);
			expect(count).toBe(0);
		});

		it("should prevent a user from inserting citations for another user's message", async () => {
			// Create a chat and message for the admin user
			const { data: adminChat } = await serviceRoleDbClient
				.from("chats")
				.insert({
					name: "Admin Chat",
					user_id: givenAdminId,
				})
				.select("id")
				.single();

			if (!adminChat) {
				throw new Error("Admin chat creation failed");
			}

			const { data: adminMessage } = await serviceRoleDbClient
				.from("chat_messages")
				.insert({
					chat_id: adminChat.id,
					role: "user",
					content: "Admin message",
					type: "text",
				})
				.select("id")
				.single();

			if (!adminMessage) {
				throw new Error("Admin message creation failed");
			}

			// Try to insert citation as regular user for admin's message
			const { error } = await supabaseAnonClient
				.from("chat_message_citations")
				.insert({
					message_id: adminMessage.id,
					external_citation_ids: ["test-citation-3"],
				});

			expect(error).not.toBeNull();
			expect(error?.code).toBe("42501"); // Insufficient privileges

			// Cleanup
			await serviceRoleDbClient.from("chats").delete().eq("id", adminChat.id);
		});

		it("should prevent a user from deleting citations for another user's message", async () => {
			// Create a chat and message for the admin user
			const { data: adminChat } = await serviceRoleDbClient
				.from("chats")
				.insert({
					name: "Admin Chat",
					user_id: givenAdminId,
				})
				.select("id")
				.single();

			if (!adminChat) {
				throw new Error("Admin chat creation failed");
			}

			const { data: adminMessage } = await serviceRoleDbClient
				.from("chat_messages")
				.insert({
					chat_id: adminChat.id,
					role: "assistant",
					content: "Admin message",
					type: "text",
				})
				.select("id")
				.single();

			if (!adminMessage) {
				throw new Error("Admin message creation failed");
			}

			// Create a citation for the admin's message using service role
			const { data: citation, error: citationError } = await serviceRoleDbClient
				.from("chat_message_citations")
				.insert({
					message_id: adminMessage.id,
					external_citation_ids: ["test-citation-4"],
				})
				.select("id")
				.single();

			expect(citationError).toBeNull();
			if (!citation) {
				throw new Error("Citation creation failed");
			}

			// Try to delete the citation as regular user
			const { error: deleteError } = await supabaseAnonClient
				.from("chat_message_citations")
				.delete()
				.eq("id", citation.id);

			// RLS silently filters rows the user can't see — no error, 0 rows affected
			expect(deleteError).toBeNull();

			// Verify citation still exists
			const { count } = await serviceRoleDbClient
				.from("chat_message_citations")
				.select("*", { count: "exact", head: true })
				.eq("id", citation.id);
			expect(count).toBe(1);

			// Cleanup
			await serviceRoleDbClient.from("chats").delete().eq("id", adminChat.id);
		});
	});

	describe("external_citations RLS policies", () => {
		const testExternalCitationId = "test-external-citation-rls-001";
		const testExternalSnippet = "Test snippet content";
		const testExternalPage = 1;
		const testExternalFileName = "test-document.pdf";
		const testExternalSourceUrl = "https://example.com/test-doc";

		afterEach(async () => {
			// Clean up any test citations
			await serviceRoleDbClient
				.from("external_citations")
				.delete()
				.eq("id", testExternalCitationId);
		});

		it("should allow authenticated users to insert external citations", async () => {
			await supabaseAnonClient.auth.signInWithPassword({
				email: givenUserEmail,
				password: givenUserPassword,
			});

			// Insert without .select() — the SELECT policy scopes visibility
			// to citations linked via chat_message_citations, so RETURNING
			// would fail on an unlinked row.
			const { error } = await supabaseAnonClient
				.from("external_citations")
				.insert({
					id: testExternalCitationId,
					snippet: testExternalSnippet,
					page: testExternalPage,
					file_name: testExternalFileName,
					source_url: testExternalSourceUrl,
					created_at: new Date().toISOString(),
					source_type: "parla_document",
				});

			expect(error).toBeNull();

			// Verify the row was actually created
			const { data } = await serviceRoleDbClient
				.from("external_citations")
				.select("id")
				.eq("id", testExternalCitationId)
				.single();

			expect(data?.id).toBe(testExternalCitationId);
		});

		it("should prevent unauthenticated users from inserting external citations", async () => {
			// Sign out to ensure no user is authenticated
			await supabaseAnonClient.auth.signOut();

			const { error } = await supabaseAnonClient
				.from("external_citations")
				.insert({
					id: testExternalCitationId,
					snippet: testExternalSnippet,
					page: testExternalPage,
					file_name: testExternalFileName,
					source_url: testExternalSourceUrl,
					created_at: new Date().toISOString(),
					source_type: "parla_document",
				});

			expect(error).not.toBeNull();
			expect(error?.code).toBe("42501"); // Insufficient privileges
		});

		it("should prevent users from deleting external citations directly", async () => {
			// First create a citation using service role
			const { error: insertError } = await serviceRoleDbClient
				.from("external_citations")
				.insert({
					id: testExternalCitationId,
					snippet: testExternalSnippet,
					page: testExternalPage,
					file_name: testExternalFileName,
					source_url: testExternalSourceUrl,
					created_at: new Date().toISOString(),
					source_type: "parla_document",
				});
			expect(insertError).toBeNull();

			// Sign in as user
			await supabaseAnonClient.auth.signInWithPassword({
				email: givenUserEmail,
				password: givenUserPassword,
			});

			// Try to delete the external citation
			const { error: deleteError } = await supabaseAnonClient
				.from("external_citations")
				.delete()
				.eq("id", testExternalCitationId);

			// RLS silently filters rows the user can't see — no error, 0 rows affected
			expect(deleteError).toBeNull();

			// Verify citation still exists
			const { count } = await serviceRoleDbClient
				.from("external_citations")
				.select("*", { count: "exact", head: true })
				.eq("id", testExternalCitationId);
			expect(count).toBe(1);
		});

		it("should prevent users from updating external citations", async () => {
			// First create a citation using service role
			const { error: insertError } = await serviceRoleDbClient
				.from("external_citations")
				.insert({
					id: testExternalCitationId,
					snippet: testExternalSnippet,
					page: testExternalPage,
					file_name: testExternalFileName,
					source_url: testExternalSourceUrl,
					created_at: new Date().toISOString(),
					source_type: "parla_document",
				});
			expect(insertError).toBeNull();

			// Sign in as user
			await supabaseAnonClient.auth.signInWithPassword({
				email: givenUserEmail,
				password: givenUserPassword,
			});

			// Try to update the external citation
			const { error: updateError } = await supabaseAnonClient
				.from("external_citations")
				.update({
					snippet: "Updated snippet",
				})
				.eq("id", testExternalCitationId);

			// RLS silently filters rows the user can't see — no error, 0 rows affected
			expect(updateError).toBeNull();

			// Verify citation was not updated
			const { data } = await serviceRoleDbClient
				.from("external_citations")
				.select("snippet")
				.eq("id", testExternalCitationId)
				.single();
			expect(data?.snippet).toBe(testExternalSnippet);
		});
	});
});
