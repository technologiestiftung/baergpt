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

describe("Integration tests for DB", async () => {
	describe("registration meta-data", () => {
		it("should create a profile with the first_name and last_name from the meta-data", async () => {
			const givenEmail = "example@local.berlin.de";
			const givenPassword = "SecurePassword123!";
			const givenFirstName = "John";
			const givenLastName = "Doe";

			const { data, error: signupError } = await supabaseAnonClient.auth.signUp(
				{
					email: givenEmail,
					password: givenPassword,
					options: {
						data: {
							first_name: givenFirstName,
							last_name: givenLastName,
						},
					},
				},
			);

			if (!data.user) {
				throw new Error("User is undefined");
			}
			expect(signupError).toBeNull();

			const { data: actualProfile, error: profileError } =
				await serviceRoleDbClient
					.from("profiles")
					.select("first_name, last_name")
					.eq("id", data.user.id)
					.single();

			const expectedProfile = {
				first_name: givenFirstName,
				last_name: givenLastName,
			};

			expect(profileError).toBeNull();
			expect(actualProfile).toStrictEqual(expectedProfile);

			const { error: deleteError } =
				await serviceRoleDbClient.auth.admin.deleteUser(data.user.id);
			expect(deleteError).toBeNull();
		});
	});

	describe("application users", async () => {
		const givenAdminId = "d18922bb-7f9a-4e15-a9c9-6788fe81842c";
		const givenAdminEmail = "db-test-suite-admin@local.berlin.de";
		const givenAdminPassword = "SecurePassword123!";

		const givenUserId = "73f1b859-1377-4f72-ac92-ea28b1fb5167";
		const givenUserEmail = "db-test-suite-user@local.berlin.de";
		const givenUserPassword = "SecurePassword123!";

		const { data: accessGroupData } = await serviceRoleDbClient
			.from("access_groups")
			.select("id")
			.eq("name", "Alle")
			.single();

		if (!accessGroupData) {
			throw new Error("Default access group not found");
		}

		const accessGroupId = accessGroupData.id;

		const users = [
			{
				id: givenAdminId,
				email: givenAdminEmail,
				password: givenAdminPassword,
			},
			{ id: givenUserId, email: givenUserEmail, password: givenUserPassword },
		];

		beforeAll(async () => {
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

		describe("validate_email_domain()", () => {
			const validEmail = "test@local.berlin.de";
			const validEmail2 = "test2@local.berlin.de";
			const invalidEmail = "test@not-allowed.com";
			let userId: string = "";

			it("should validate the email domain during registration", async () => {
				const { data, error: signupError } =
					await serviceRoleDbClient.auth.admin.createUser({
						email: validEmail,
						password: givenUserPassword,
						email_confirm: true,
					});
				userId = data.user?.id ?? "";
				expect(userId).not.toBe("");
				expect(signupError).toBeNull();
			});

			it("should reject registration with invalid email domain", async () => {
				const { error: signupError } =
					await serviceRoleDbClient.auth.admin.createUser({
						email: invalidEmail,
						password: givenUserPassword,
						email_confirm: true,
					});
				expect(signupError).not.toBeNull();
			});

			it("should allow email change to valid domain", async () => {
				const { data: sessionData, error: sessionError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: validEmail,
						password: givenUserPassword,
					});
				expect(sessionError).toBeNull();
				expect(sessionData.session).not.toBeNull();
				expect(userId).not.toBe("");
				const { error: updateError } =
					await serviceRoleDbClient.auth.admin.updateUserById(userId, {
						email: validEmail2,
					});
				expect(updateError).toBeNull();
			});

			it("should reject email change to invalid domain", async () => {
				expect(userId).not.toBe("");
				const { error: updateError } =
					await serviceRoleDbClient.auth.admin.updateUserById(userId, {
						email: invalidEmail,
					});
				expect(updateError).not.toBeNull();
			});

			it("should reject emails with invalid format", async () => {
				const { error } = await serviceRoleDbClient.auth.admin.createUser({
					email: "@local.berlin.de",
					password: givenUserPassword,
					email_confirm: true,
				});
				expect(error).not.toBeNull();
			});

			it("should allow registration with exact domain match", async () => {
				const { data, error } = await serviceRoleDbClient.auth.admin.createUser(
					{
						email: "test@ts.berlin",
						password: givenUserPassword,
						email_confirm: true,
					},
				);
				expect(error).toBeNull();
				if (data.user?.id) {
					await serviceRoleDbClient.auth.admin.deleteUser(data.user.id);
				}
			});

			afterAll(async () => {
				if (userId) {
					await serviceRoleDbClient.auth.admin.deleteUser(userId);
				}
			});
		});

		describe("is_application_admin()", () => {
			it("Non-admin users should be able to see their own admin status", async () => {
				const { data: sessionData, error: sessionError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});
				expect(sessionError).toBeNull();
				expect(sessionData.session).not.toBeNull();

				const { data: isAdmin, error: rpcError } = await supabaseAnonClient.rpc(
					"is_application_admin",
				);

				expect(rpcError).toBeNull();
				expect(isAdmin).toBe(false);
			});

			it("Admin users should be able to see their own admin status", async () => {
				const { data: sessionData, error: sessionError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenAdminEmail,
						password: givenAdminPassword,
					});
				expect(sessionError).toBeNull();
				expect(sessionData.session).not.toBeNull();

				const { data: isAdmin, error: rpcError } = await supabaseAnonClient.rpc(
					"is_application_admin",
				);

				expect(rpcError).toBeNull();
				expect(isAdmin).toBe(true);
			});
		});

		describe("applications_admins table permissions", () => {
			it("Users should not be able to read the applications_admins table", async () => {
				const { data: sessionData, error: sessionError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});
				expect(sessionError).toBeNull();
				expect(sessionData.session).not.toBeNull();

				const { data, error: selectError } = await supabaseAnonClient
					.from("application_admins")
					.select("*");

				expect(selectError).toBeNull();
				expect(data).toStrictEqual([]);
			});
		});

		describe("profiles table permissions", () => {
			it("Users should be able to read and update only their own profile", async () => {
				const { data: sessionData, error: sessionError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});
				expect(sessionError).toBeNull();

				if (!sessionData.session?.user) {
					throw new Error("User is undefined");
				}

				const { data, error: selectError } = await supabaseAnonClient
					.from("profiles")
					.select("*");
				if (!data) {
					throw new Error("Data is undefined");
				}
				expect(selectError).toBeNull();
				/**
				 * Note: there are 2 users in the database, so we expect to see only 1 profile (the current user's one)
				 */
				expect(data.length).toBe(1);
				expect(data[0].id).toEqual(sessionData.session.user.id);

				const { error: updateError } = await supabaseAnonClient
					.from("profiles")
					.update({ first_name: "UpdatedName" })
					.eq("id", sessionData.session.user.id);
				expect(updateError).toBeNull();

				const { data: updatedProfile, error: selectUpdatedError } =
					await supabaseAnonClient
						.from("profiles")
						.select("*")
						.eq("id", sessionData.session.user.id)
						.single();
				if (!updatedProfile) {
					throw new Error("Updated profile is undefined");
				}
				expect(selectUpdatedError).toBeNull();
				expect(updatedProfile.first_name).toBe("UpdatedName");
			});
		});

		describe("user_active_status table permission", () => {
			it("Users should not be able to read the user_active_status table", async () => {
				const { data: sessionData, error: sessionError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});
				expect(sessionError).toBeNull();
				expect(sessionData.session).not.toBeNull();

				const { data, error: selectError } = await supabaseAnonClient
					.from("user_active_status")
					.select("*");

				expect(selectError).toBeNull();
				expect(data).toStrictEqual([]);
			});

			it("Users should be able to get their active status via is_current_user_active() RPC", async () => {
				const { data: sessionData, error: sessionError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});
				expect(sessionError).toBeNull();
				expect(sessionData.session).not.toBeNull();

				const { data: isActive, error: rpcError } =
					await supabaseAnonClient.rpc("is_current_user_active");

				expect(rpcError).toBeNull();
				expect(isActive).toBe(true);
			});
		});

		describe("get_users function", () => {
			it("Should return all users", async () => {
				// Sign in as the admin user
				const { data: sessionData, error: sessionError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenAdminEmail,
						password: givenAdminPassword,
					});
				expect(sessionError).toBeNull();
				expect(sessionData.session).not.toBeNull();

				// Call the get_users RPC as the signed-in admin session
				const { data: allUsers, error } =
					await supabaseAnonClient.rpc("get_users");

				expect(error).toBeNull();
				expect(allUsers).toBeDefined();

				const foundAdmin = allUsers?.find(
					(user: { email: string }) => user.email === givenAdminEmail,
				);
				const foundUser = allUsers?.find(
					(user: { email: string }) => user.email === givenUserEmail,
				);

				expect(foundAdmin).toBeDefined();
				expect(foundUser).toBeDefined();
			});

			it("Should return permission error if non admin user tries to get users", async () => {
				// Sign in as the non-admin user
				const { data, error } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});

				expect(error).toBeNull();
				expect(data.session).toBeDefined();

				// Call the get_users RPC as a non-admin user and expect a permission error
				const { data: usersData, error: rpcError } =
					await supabaseAnonClient.rpc("get_users");

				expect(usersData).toBeNull();
				expect(rpcError).not.toBeNull();
				expect((rpcError as Error)?.message).toContain("Permission denied");
			});
		});

		describe("add_user_to_access_group function", () => {
			it("should automatically add new users to the default access group", async () => {
				// Check that the default access group "Alle" exists
				const { data: accessGroups, error: accessGroupError } =
					await supabaseAnonClient
						.from("access_groups")
						.select("id")
						.eq("name", "Alle")
						.single();

				expect(accessGroupError).toBeNull();
				expect(accessGroups).toBeDefined();

				const defaultAccessGroupId = accessGroups?.id;

				if (!defaultAccessGroupId) {
					throw new Error("Default access group ID is undefined");
				}

				// Get user IDs from auth.users table using admin client
				const { data: allUsers, error: listUsersError } =
					await serviceRoleDbClient.auth.admin.listUsers();

				expect(listUsersError).toBeNull();

				if (listUsersError !== null) {
					throw new Error("User could not be listed");
				}

				expect(allUsers).toBeDefined();

				const adminUser = allUsers.users.find(
					(user) => user.email === givenAdminEmail,
				);
				const regularUser = allUsers.users.find(
					(user) => user.email === givenUserEmail,
				);

				if (!adminUser || !regularUser) {
					throw new Error("User not found");
				}

				const adminUserId = adminUser.id;
				const regularUserId = regularUser.id;

				// Check that the admin and the user were added to the default access group
				const { data: accessGroupMembers, error: memberError } =
					await serviceRoleDbClient
						.from("access_group_members")
						.select("user_id, access_group_id")
						.in("user_id", [adminUserId, regularUserId])
						.eq("access_group_id", defaultAccessGroupId);

				expect(memberError).toBeNull();
				expect(accessGroupMembers).toBeDefined();
				expect(accessGroupMembers?.length).toBe(2);
			});
		});

		describe("delete_user function", () => {
			let givenChatId: number;

			beforeEach(async () => {
				const { data: chatData, error: chatError } = await serviceRoleDbClient
					.from("chats")
					.insert({
						user_id: givenAdminId,
						name: "Test Chat",
					})
					.select("id")
					.single();
				if (!chatData) {
					throw new Error("Chat data is undefined");
				}
				givenChatId = chatData.id;

				expect(chatError).toBeNull();

				const { error: chatMessageError } = await serviceRoleDbClient
					.from("chat_messages")
					.insert({
						chat_id: givenChatId,
						role: "user",
						content: "Hello, this is a test message.",
						citations: null,
						allowed_document_ids: [],
						allowed_folder_ids: [],
						type: "text",
					});

				expect(chatMessageError).toBeNull();

				const { error: documentFoldersError } = await serviceRoleDbClient
					.from("document_folders")
					.insert({
						user_id: givenAdminId,
						name: "Test Folder",
					});

				expect(documentFoldersError).toBeNull();

				await mockDocumentUpload({
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

			afterEach(async () => {
				await cleanupDocuments(givenAdminId);
			});

			it("should delete the admin user", async () => {
				// Sign in as the admin user
				const { data: signinData, error: signinError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenAdminEmail,
						password: givenAdminPassword,
					});
				if (!signinData.session?.user) {
					throw new Error("User is undefined");
				}
				expect(signinError).toBeNull();
				expect(signinData.session).not.toBeNull();
				expect(signinData.session.user.id).toBeDefined();

				// Call the delete_user function
				const { error: deleteError } =
					await supabaseAnonClient.rpc("delete_user");
				expect(deleteError).toBeNull();

				// Verify the user no longer exists
				const { error: getUserError } =
					await serviceRoleDbClient.auth.admin.getUserById(givenAdminId);

				// After successful deletion, we should get a "user not found" error
				expect(getUserError?.message).toBe("User not found");

				const { data: accessGroupMembersData, error: accessGroupMembersError } =
					await serviceRoleDbClient
						.from("access_group_members")
						.select("*")
						.eq("user_id", givenAdminId);

				expect(accessGroupMembersError).toBeNull();
				expect(accessGroupMembersData?.length).toBe(0);

				const { data: applicationAdminsData, error: applicationAdminsError } =
					await serviceRoleDbClient
						.from("application_admins")
						.select("*")
						.eq("user_id", givenAdminId);

				expect(applicationAdminsError).toBeNull();
				expect(applicationAdminsData?.length).toBe(0);

				const { data: chatMessages, error: chatMessagesError } =
					await serviceRoleDbClient
						.from("chat_messages")
						.select("*")
						.eq("chat_id", givenChatId);

				expect(chatMessagesError).toBeNull();
				expect(chatMessages?.length).toBe(0);

				const { data: chatsData, error: chatsError } = await serviceRoleDbClient
					.from("chats")
					.select("*")
					.eq("user_id", givenAdminId);

				expect(chatsError).toBeNull();
				expect(chatsData?.length).toBe(0);

				const { data: documentChunksData, error: documentChunksError } =
					await serviceRoleDbClient
						.from("document_chunks")
						.select("*")
						.eq("owned_by_user_id", givenAdminId);

				expect(documentChunksError).toBeNull();
				expect(documentChunksData?.length).toBe(0);

				const { data: documentFoldersData, error: documentFoldersError } =
					await serviceRoleDbClient
						.from("document_folders")
						.select("*")
						.eq("user_id", givenAdminId);

				expect(documentFoldersError).toBeNull();
				expect(documentFoldersData?.length).toBe(0);

				const { data: documentSummariesData, error: documentSummariesError } =
					await serviceRoleDbClient
						.from("document_summaries")
						.select("*")
						.eq("owned_by_user_id", givenAdminId);

				expect(documentSummariesError).toBeNull();
				expect(documentSummariesData?.length).toBe(0);

				const { data: documentsData, error: documentsError } =
					await serviceRoleDbClient
						.from("documents")
						.select("*")
						.eq("owned_by_user_id", givenAdminId);

				expect(documentsError).toBeNull();
				expect(documentsData?.length).toBe(0);

				const { data: profileData, error: profileError } =
					await serviceRoleDbClient
						.from("profiles")
						.select("*")
						.eq("id", givenAdminId);

				expect(profileError).toBeNull();
				expect(profileData?.length).toBe(0);

				const { data: userActiveStatusData, error: userActiveStatusError } =
					await serviceRoleDbClient
						.from("user_active_status")
						.select("*")
						.eq("id", givenAdminId);

				expect(userActiveStatusError).toBeNull();
				expect(userActiveStatusData?.length).toBe(0);

				// manually delete storage files using supabase sdk
				const { error: deleteStorageError } = await serviceRoleDbClient.storage
					.from("documents")
					.remove([`${givenAdminId}/${defaultDocumentName}`]);
				expect(deleteStorageError).toBeNull();

				/**
				 * Re-create the user to avoid side effects on other tests
				 */
				const { error: signupError } =
					await serviceRoleDbClient.auth.admin.createUser({
						id: givenAdminId,
						email: givenAdminEmail,
						password: givenAdminPassword,
						email_confirm: true,
					});

				expect(signupError).toBeNull();

				// Re-add the user to application_admins
				const { error: setAdminError } = await serviceRoleDbClient
					.from("application_admins")
					.insert({ user_id: givenAdminId });

				expect(setAdminError).toBeNull();
			});
		});

		describe("get_citation_details", () => {
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

					const { data: citationDetails } = await supabaseAnonClient.rpc(
						"get_citation_details",
						{
							chunk_ids: [givenChunkId],
						},
					);

					if (!citationDetails) {
						throw new Error("Citation details are undefined");
					}

					const expectedCitationDetails = {
						chunk_id: givenChunkId,
						file_name: defaultDocumentName,
						source_url: `${givenAdminId}/${defaultDocumentName}`,
						page: 1,
						source_type: "personal_document",
						snippet,
					};

					expect(citationDetails[0]).toMatchObject(expectedCitationDetails);
				});

				it("should return no citation details for a not self-owned document", async () => {
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});

					const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
						"get_citation_details",
						{
							chunk_ids: [givenChunkId],
						},
					);

					const expectedCitationDetails = [];

					expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
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

					const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
						"get_citation_details",
						{
							chunk_ids: [givenChunkId],
						},
					);

					const expectedCitationDetails = [
						{
							chunk_id: givenChunkId,
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
					const { error: signInError } =
						await supabaseAnonClient.auth.signInWithPassword({
							email: givenUserEmail,
							password: givenUserPassword,
						});

					expect(signInError).toBeNull();

					const { data: actualCitationDetails, error } =
						await supabaseAnonClient.rpc("get_citation_details", {
							chunk_ids: [givenChunkId],
						});
					expect(error).toBeNull();

					const expectedCitationDetails = [
						{
							chunk_id: givenChunkId,
							file_name: defaultDocumentName,
							source_url: `${accessGroupId}/${defaultDocumentName}`,
							page: 1,
							source_type: "public_document",
							snippet,
						},
					];

					expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
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

					const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
						"get_citation_details",
						{
							chunk_ids: [givenChunkId],
						},
					);

					const expectedCitationDetails = [
						{
							chunk_id: givenChunkId,
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
					const { error: signInError } =
						await supabaseAnonClient.auth.signInWithPassword({
							email: givenUserEmail,
							password: givenUserPassword,
						});

					expect(signInError).toBeNull();

					const { data: actualCitationDetails, error } =
						await supabaseAnonClient.rpc("get_citation_details", {
							chunk_ids: [givenChunkId],
						});
					expect(error).toBeNull();

					const expectedCitationDetails = [
						{
							chunk_id: givenChunkId,
							file_name: defaultDocumentName,
							source_url: `${accessGroupId}/${defaultDocumentName}`,
							page: 1,
							source_type: "default_document",
							snippet,
						},
					];

					expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
				});
			});

			describe("invalid args", () => {
				beforeEach(async () => {
					await mockDocumentUpload({
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

				it("should return no citation details when given an empty array", async () => {
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});

					const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
						"get_citation_details",
						{
							chunk_ids: [],
						},
					);

					const expectedCitationDetails = [];

					expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
				});
			});
		});
	});
});
