import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";

/**
 * AdminService handles operations that require the Supabase service role key.
 * These operations cannot be performed with user JWTs and must use elevated privileges.
 *
 * Operations include:
 * - Auth Admin API calls (updateUserById, deleteUser, inviteUserByEmail)
 * - Writing to privileged tables (application_admins)
 * - Soft/hard user deletion and restoration
 */
export class AdminService {
	private readonly adminClient: SupabaseClient<Database>;

	constructor(adminClient: SupabaseClient<Database>) {
		this.adminClient = adminClient;
	}

	/**
	 * Updates user profile including auth metadata and profiles table.
	 * Requires service role for auth.admin.updateUserById().
	 */
	async updateUserProfile({
		userId,
		firstName,
		lastName,
		academic_title,
		email,
		personal_title,
	}: {
		userId: string;
		firstName?: string;
		lastName?: string;
		academic_title?: string;
		email?: string;
		personal_title?: string;
	}): Promise<void> {
		// Prepare auth update data
		const authUpdateData: {
			user_metadata?: { first_name?: string; last_name?: string };
			email?: string;
		} = {};

		// Add user metadata if firstName or lastName are provided
		if (firstName !== undefined || lastName !== undefined) {
			authUpdateData.user_metadata = {
				first_name: firstName,
				last_name: lastName,
			};
		}

		// Add email if provided
		if (email !== undefined) {
			authUpdateData.email = email;
		}

		// Update user in auth (requires service role)
		if (Object.keys(authUpdateData).length > 0) {
			const { error: authError } =
				await this.adminClient.auth.admin.updateUserById(
					userId,
					authUpdateData,
				);

			if (authError) {
				throw authError;
			}
		}

		// Update first_name, last_name, academic_title and personal_title in profiles table
		const updateData = Object.fromEntries(
			Object.entries({
				first_name: firstName,
				last_name: lastName,
				academic_title: academic_title,
				personal_title: personal_title,
			}).filter(([, value]) => value !== undefined),
		);

		if (Object.keys(updateData).length > 0) {
			const { error: profileError } = await this.adminClient
				.from("profiles")
				.update(updateData)
				.eq("id", userId);

			if (profileError) {
				throw profileError;
			}
		}
	}

	/**
	 * Updates the admin status of a user.
	 * Requires service role to write to application_admins table.
	 */
	async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
		if (typeof isAdmin !== "boolean") {
			throw new Error("isAdmin must be a boolean value");
		}

		if (isAdmin) {
			// Add user to application_admins table
			const { error } = await this.adminClient
				.from("application_admins")
				.insert({ user_id: userId });

			if (error) {
				throw error;
			}

			return;
		}

		// Remove user from application_admins table
		const { error } = await this.adminClient
			.from("application_admins")
			.delete()
			.eq("user_id", userId);

		if (error) {
			throw error;
		}
	}

	/**
	 * Soft delete a user by setting deleted_at timestamp.
	 * Requires service role to update user_active_status.
	 */
	async softDeleteUser(userId: string): Promise<void> {
		const { error } = await this.adminClient
			.from("user_active_status")
			.update({ deleted_at: new Date().toISOString(), is_active: false })
			.eq("id", userId);

		if (error) {
			throw error;
		}
	}

	/**
	 * Hard delete a user (permanently removes from auth and cascades to profile).
	 * Requires service role for auth.admin.deleteUser().
	 */
	async hardDeleteUser(userId: string): Promise<void> {
		const { error } = await this.adminClient.auth.admin.deleteUser(userId);

		if (error) {
			throw error;
		}
	}

	/**
	 * Restore a soft-deleted user.
	 * Requires service role to update user_active_status.
	 */
	async restoreUser(userId: string): Promise<void> {
		const { error } = await this.adminClient
			.from("user_active_status")
			.update({ deleted_at: null, is_active: true })
			.eq("id", userId);

		if (error) {
			throw error;
		}
	}

	/**
	 * Send invite link to user.
	 * Requires service role for auth.admin.inviteUserByEmail().
	 */
	async sendInviteLink(
		email: string,
		firstName?: string,
		lastName?: string,
	): Promise<void> {
		const data: { first_name?: string; last_name?: string } = {};

		if (firstName) {
			data.first_name = firstName;
		}
		if (lastName) {
			data.last_name = lastName;
		}

		const { error } = await this.adminClient.auth.admin.inviteUserByEmail(
			email,
			{
				data,
			},
		);

		if (error) {
			throw error;
		}
	}
}
