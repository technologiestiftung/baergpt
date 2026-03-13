import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { serviceRoleDbClient } from "../supabase";
import type { Database } from "@repo/db-schema";
import { subDays } from "date-fns";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

type DailyUsers = {
	date: string;
	total: number;
	new: number;
};

type ProductDashboardStats = {
	daily_user_evolution: DailyUsers[];
	dau: number;
	wau: number;
	mau: number;
	domains: {
		count: number;
		domain: string;
	}[];
	total_chats: number;
	total_user_documents: number;
	average_inferences_per_user: number;
	total_messages_with_documents: 0;
	total_messages_without_documents: 0;
};

const TIMEOUT = 60_000;

const applicationAdminDbClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("get_product_dashboard_stats", () => {
	const givenAdminId = crypto.randomUUID();
	const givenAdminEmail =
		"admin-test-suite-product-dashboard-stats@local.berlin.de";
	const givenAdminPassword = "SecurePassword123!";

	beforeAll(async () => {
		await registerAdmin({
			id: givenAdminId,
			email: givenAdminEmail,
			password: givenAdminPassword,
		});

		await applicationAdminDbClient.auth.signInWithPassword({
			email: givenAdminEmail,
			password: givenAdminPassword,
		});
	});

	afterAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(givenAdminId);
	});

	describe("user registration, login and domain statistics", () => {
		let givenUsers: Awaited<ReturnType<typeof registerManyUsers>>;

		beforeAll(async () => {
			givenUsers = await registerManyUsers();
		}, TIMEOUT);

		afterAll(async () => {
			for (const user of givenUsers) {
				const { error } = await serviceRoleDbClient.auth.admin.deleteUser(
					user.id,
				);
				if (error) {
					expect(error).toBeNull();
				}
			}
		}, TIMEOUT);

		it("returns the expected top-level keys", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			expect(data).toBeDefined();
			expect(data).toHaveProperty("daily_user_evolution");
			expect(data).toHaveProperty("dau");
			expect(data).toHaveProperty("wau");
			expect(data).toHaveProperty("mau");
			expect(data).toHaveProperty("domains");
		});

		it("returns daily_user_evolution as an array of 30 days", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			expect(
				Array.isArray((data as ProductDashboardStats).daily_user_evolution),
			).toBe(true);
			expect((data as ProductDashboardStats).daily_user_evolution).toHaveLength(
				30,
			);
		});

		it("each daily_user_evolution entry has date, total, and new fields", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			for (const entry of (data as ProductDashboardStats)
				.daily_user_evolution) {
				expect(entry).toHaveProperty("date");
				expect(entry).toHaveProperty("total");
				expect(entry).toHaveProperty("new");
				expect(typeof entry.total).toBe("number");
				expect(typeof entry.new).toBe("number");
				expect(entry.new).toBeLessThanOrEqual(entry.total);
			}
		});

		it("dau, wau, mau are non-negative numbers", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			expect(typeof (data as ProductDashboardStats).dau).toBe("number");
			expect(typeof (data as ProductDashboardStats).wau).toBe("number");
			expect(typeof (data as ProductDashboardStats).mau).toBe("number");
			expect((data as ProductDashboardStats).dau).toBeGreaterThanOrEqual(0);
			expect((data as ProductDashboardStats).wau).toBeGreaterThanOrEqual(0);
			expect((data as ProductDashboardStats).mau).toBeGreaterThanOrEqual(0);
		});

		it("dau <= wau <= mau (activity windows are cumulative)", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			expect((data as ProductDashboardStats).dau).toBeLessThanOrEqual(
				(data as ProductDashboardStats).wau,
			);
			expect((data as ProductDashboardStats).wau).toBeLessThanOrEqual(
				(data as ProductDashboardStats).mau,
			);
		});

		it("domains is an array and each entry has domain and count", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			expect(Array.isArray((data as ProductDashboardStats).domains)).toBe(true);
			expect((data as ProductDashboardStats).domains.length).toBeGreaterThan(0);
			for (const entry of (data as ProductDashboardStats).domains) {
				expect(entry).toHaveProperty("domain");
				expect(entry).toHaveProperty("count");
				expect(typeof entry.domain).toBe("string");
				expect(typeof entry.count).toBe("number");
				expect(entry.count).toBeGreaterThan(0);
			}
		});

		it("should return correct total_chats", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			expect(typeof (data as ProductDashboardStats).total_chats).toBe("number");
			expect(
				(data as ProductDashboardStats).total_chats,
			).toBeGreaterThanOrEqual(0);
		});
	});

	/**
	 * NOTE: this test suite needs an empty DB to run properly,
	 * otherwise the expected values won't be correct and the tests will fail.
	 */
	describe("usage and chat statistics", () => {
		const givenDocumentIds = [999_995, 999_996, 999_997, 999_998, 999_999];
		const givenChats = [
			{
				chatId: 999_998,
				chatMessageIds: [999_990, 999_991, 999_992, 999_993],
			},
			{ chatId: 999_999, chatMessageIds: [999_994, 999_995, 999_996, 999_997] },
		];
		const givenUserId = crypto.randomUUID();
		const givenUserEmail =
			"user-test-suite-product-dashboard-stats@local.berlin.de";
		const givenUserPassword = "SecurePassword123!";

		beforeAll(async () => {
			await registerNonAdminUser({
				id: givenUserId,
				email: givenUserEmail,
				password: givenUserPassword,
			});

			await insertDocuments({
				documentIds: givenDocumentIds,
				userId: givenUserId,
			});

			await insertChatsAndMessages({
				chats: givenChats,
				userId: givenUserId,
				documentIds: givenDocumentIds,
			});
		}, TIMEOUT);

		afterAll(async () => {
			const { error } =
				await serviceRoleDbClient.auth.admin.deleteUser(givenUserId);
			expect(error).toBeNull();

			const { error: deleteDocumentsError } = await serviceRoleDbClient
				.from("documents")
				.delete()
				.in("id", givenDocumentIds);
			expect(deleteDocumentsError).toBeNull();

			const chatIds = givenChats.map((chat) => chat.chatId);
			const { error: deleteChatsError } = await serviceRoleDbClient
				.from("chats")
				.delete()
				.in("id", chatIds);
			expect(deleteChatsError).toBeNull();
		}, TIMEOUT);

		it("should return correct total_chats", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			expect((data as ProductDashboardStats).total_chats).toBe(
				givenChats.length,
			);
		});

		it("should return correct total_user_documents", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			expect(error).toBeNull();
			expect((data as ProductDashboardStats).total_user_documents).toBe(
				givenDocumentIds.length,
			);
		});

		it("should return correct average_inferences_per_user", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			const expectedAverageInferencesPerUser =
				getExpectedAverageInferencesPerUser();

			expect(error).toBeNull();
			expect((data as ProductDashboardStats).average_inferences_per_user).toBe(
				expectedAverageInferencesPerUser,
			);
		});

		it("should return correct total_messages_with_documents", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			const expectedTotalMessagesWithDocuments = 4; // The messages from chatId 2 have documents

			expect(error).toBeNull();
			expect(
				(data as ProductDashboardStats).total_messages_with_documents,
			).toBe(expectedTotalMessagesWithDocuments);
		});

		it("should return correct total_messages_without_documents", async () => {
			const { data, error } = await applicationAdminDbClient.rpc(
				"get_product_dashboard_stats",
			);

			const expectedTotalMessagesWithoutDocuments = 4; // The messages from chatId 1 have no documents

			expect(error).toBeNull();
			expect(
				(data as ProductDashboardStats).total_messages_without_documents,
			).toBe(expectedTotalMessagesWithoutDocuments);
		});
	});
});

async function registerAdmin(params: {
	id: string;
	email: string;
	password: string;
}) {
	const { id, email, password } = params;

	const { error: createUserError } =
		await serviceRoleDbClient.auth.admin.createUser({
			id,
			email,
			password,
			email_confirm: true,
		});

	if (createUserError) {
		expect(createUserError).toBeNull();
	}

	const { error: setAdminError } = await serviceRoleDbClient
		.from("application_admins")
		.insert({ user_id: id });

	expect(setAdminError).toBeNull();
}

function pickRandom(domains: string[]): string {
	return domains[Math.floor(Math.random() * domains.length)];
}

async function registerManyUsers() {
	const { data, error } = await serviceRoleDbClient
		.from("allowed_email_domains")
		.select("domain");

	if (error) {
		expect(error).toBeNull();
	}

	const domains = data.map((entry) => entry.domain);

	const domainsWithoutWildcard = domains.filter(
		(domain) => !domain.includes("*"),
	);

	const users = [];
	const days = 30;
	let maxUsersPerDay = 1;

	for (let dayIndex = 1; dayIndex < days; dayIndex++) {
		for (let usersPerDay = 1; usersPerDay <= maxUsersPerDay; usersPerDay++) {
			const today = new Date();

			const randomDay = subDays(today, Math.floor(Math.random() * dayIndex));

			const creationDate = subDays(today, dayIndex);

			users.push({
				id: crypto.randomUUID(),
				email: `${dayIndex}-${usersPerDay}@${pickRandom(domainsWithoutWildcard)}`,
				password: "password",
				creationDate,
				lastSignIn: randomDay,
			});
		}
		maxUsersPerDay++;
	}

	for (const user of users) {
		const { error: createUserError } =
			await serviceRoleDbClient.auth.admin.createUser({
				id: user.id,
				email: user.email,
				password: user.password,
				email_confirm: true,
			});

		if (createUserError) {
			expect(createUserError).toBeNull();
		}

		const { error: updateUserError1 } = await serviceRoleDbClient.rpc(
			"update_user_email_confirmed_at",
			{
				user_id: user.id,
				new_email_confirmed_at: user.creationDate.toISOString(),
			},
		);

		if (updateUserError1) {
			expect(updateUserError1).toBeNull();
		}

		const { error: updateUserError2 } = await serviceRoleDbClient.rpc(
			"update_user_last_sign_in_at",
			{
				user_id: user.id,
				new_last_sign_in_at: user.lastSignIn.toISOString(),
			},
		);

		if (updateUserError2) {
			expect(updateUserError2).toBeNull();
		}
	}

	return users;
}

async function registerNonAdminUser(param: {
	id: `${string}-${string}-${string}-${string}-${string}`;
	email: string;
	password: string;
}) {
	const { id, email, password } = param;

	const { error: createUserError } =
		await serviceRoleDbClient.auth.admin.createUser({
			id,
			email,
			password,
			email_confirm: true,
		});

	expect(createUserError).toBeNull();
}

async function insertDocuments({
	documentIds,
	userId,
}: {
	documentIds: number[];
	userId: string;
}) {
	for (const id of documentIds) {
		const { error } = await serviceRoleDbClient.from("documents").insert({
			id,
			owned_by_user_id: userId,
			source_url: "",
			source_type: "personal_document",
		});
		expect(error).toBeNull();
	}
}

async function insertChatsAndMessages(param: {
	chats: { chatId: number; chatMessageIds: number[] }[];
	userId: `${string}-${string}-${string}-${string}-${string}`;
	documentIds: number[];
}) {
	const { chats, userId, documentIds } = param;

	for (const { chatId, chatMessageIds } of chats) {
		const { error: chatError } = await serviceRoleDbClient
			.from("chats")
			.insert({
				name: "",
				id: chatId,
				user_id: userId,
			});
		expect(chatError).toBeNull();

		for (const chatMessageId of chatMessageIds) {
			// For testing purposes, we will allow documents for even chat IDs and no documents for odd chat IDs
			const allowed_document_ids = documentIds.filter(() => chatId % 2 === 0);

			const { error: messageError } = await serviceRoleDbClient
				.from("chat_messages")
				.insert({
					id: chatMessageId,
					chat_id: chatId,
					role: "user",
					type: "text",
					content: "",
					allowed_document_ids,
					allowed_folder_ids: [],
				});
			expect(messageError).toBeNull();
		}
	}
}

async function getExpectedAverageInferencesPerUser() {
	const { count: chatCount, error: chatCountError } = await serviceRoleDbClient
		.from("chats")
		.select("*", { count: "exact", head: true });

	expect(chatCountError).toBeNull();

	const { data, error: userCountError } =
		await serviceRoleDbClient.auth.admin.listUsers();

	expect(userCountError).toBeNull();

	return chatCount / data.users.length;
}
