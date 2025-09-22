import {
	afterEach,
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { supabase as supabaseAdminClient } from "../supabase";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/auto-generated-database-types";
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
			const givenEmail = "example@berlin.de";
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

			expect(signupError).toBeNull();

			const { data: actualProfile, error: profileError } =
				await supabaseAdminClient
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
				await supabaseAdminClient.auth.admin.deleteUser(data.user.id);
			expect(deleteError).toBeNull();
		});
	});

	describe("application users", async () => {
		const givenAdminId = "d18922bb-7f9a-4e15-a9c9-6788fe81842c";
		const givenAdminEmail = "db-test-suite-admin@berlin.de";
		const givenAdminPassword = "SecurePassword123!";

		const givenUserId = "73f1b859-1377-4f72-ac92-ea28b1fb5167";
		const givenUserEmail = "db-test-suite-user@berlin.de";
		const givenUserPassword = "SecurePassword123!";

		const {
			data: { id: accessGroupId },
		} = await supabaseAdminClient
			.from("access_groups")
			.select()
			.eq("name", "Alle")
			.single();

		const users = [
			{
				id: givenAdminId,
				email: givenAdminEmail,
				password: givenAdminPassword,
			},
			{ id: givenUserId, email: givenUserEmail, password: givenUserPassword },
		];

		beforeAll(async () => {
			for (const user of users) {
				const { error: signupError } =
					await supabaseAdminClient.auth.admin.createUser({
						id: user.id,
						email: user.email,
						password: user.password,
						email_confirm: true,
					});

				expect(signupError).toBeNull();
			}

			const { error: setAdminError } = await supabaseAdminClient
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
					await supabaseAdminClient.auth.admin.deleteUser(id);
				expect(deleteError).toBeNull();
			}
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
				expect(sessionData.session).not.toBeNull();

				const { data, error: selectError } = await supabaseAnonClient
					.from("profiles")
					.select("*");

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
					await supabaseAdminClient.auth.admin.listUsers();

				expect(listUsersError).toBeNull();
				expect(allUsers).toBeDefined();

				const adminUser = allUsers.users.find(
					(user) => user.email === givenAdminEmail,
				);
				const regularUser = allUsers.users.find(
					(user) => user.email === givenUserEmail,
				);

				expect(adminUser).toBeDefined();
				expect(regularUser).toBeDefined();

				const adminUserId = adminUser?.id;
				const regularUserId = regularUser?.id;

				// Check that the admin and the user were added to the default access group
				const { data: accessGroupMembers, error: memberError } =
					await supabaseAdminClient
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
			it("should delete the authenticated user", async () => {
				// Sign in as the non-admin user
				const { data: signinData, error: signinError } =
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});
				expect(signinError).toBeNull();
				expect(signinData.session).not.toBeNull();
				expect(signinData.user).not.toBeNull();
				expect(signinData.user.id).toBeDefined();

				const userId = signinData.user.id;

				// Call the delete_user function
				const { error: deleteError } =
					await supabaseAnonClient.rpc("delete_user");
				expect(deleteError).toBeNull();

				// Verify the user no longer exists
				const { error: getUserError } =
					await supabaseAdminClient.auth.admin.getUserById(userId);

				// After successful deletion, we should get a "user not found" error
				expect(getUserError?.message).toBe("User not found");

				/**
				 * Re-create the user to avoid side effects on other tests
				 */
				const { error: signupError } =
					await supabaseAdminClient.auth.admin.createUser({
						id: givenUserId,
						email: givenUserEmail,
						password: givenUserPassword,
						email_confirm: true,
					});

				expect(signupError).toBeNull();
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
							source_url: `${givenAdminId}/${defaultDocumentName}`,
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
							source_url: `${givenAdminId}/${defaultDocumentName}`,
							page: 1,
							source_type: "public_document",
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

				it("should return no citation details when given null", async () => {
					await supabaseAnonClient.auth.signInWithPassword({
						email: givenUserEmail,
						password: givenUserPassword,
					});

					const { data: actualCitationDetails } = await supabaseAnonClient.rpc(
						"get_citation_details",
						{
							chunk_ids: null,
						},
					);

					const expectedCitationDetails = [];

					expect(actualCitationDetails).toMatchObject(expectedCitationDetails);
				});
			});
		});
	});
});
