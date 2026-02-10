import { captureError } from "../../monitoring/capture-error";
import type { ServiceRoleDbClient } from "../../supabase";
import { BaseContentDbService } from "./base-db-service";
/**
 * AdminService handles operations that require the Supabase service role key.
 *
 * Operations include:
 * - Auth Admin API calls (updateUserById, deleteUser, inviteUserByEmail)
 * - Writing to privileged tables (application_admins)
 * - Soft/hard user deletion and restoration
 */
export class PrivilegedDbService extends BaseContentDbService {
	protected readonly client: ServiceRoleDbClient;

	constructor(client: ServiceRoleDbClient) {
		super();
		this.client = client;
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
			const { error: authError } = await this.client.auth.admin.updateUserById(
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
			const { error: profileError } = await this.client
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
		if (isAdmin) {
			// Add user to application_admins table
			const { error } = await this.client
				.from("application_admins")
				.insert({ user_id: userId });

			if (error) {
				throw error;
			}

			return;
		}

		// Remove user from application_admins table
		const { error } = await this.client
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
		const { error } = await this.client
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
		// Get all documents for the user with storage info
		const { data: documents, error: documentsError } = await this.client
			.from("documents")
			.select("source_url, source_type")
			.eq("owned_by_user_id", userId);

		if (documentsError) {
			throw documentsError;
		}

		// Delete the user from auth (cascades to documents and related tables)
		const { error: deleteUserError } =
			await this.client.auth.admin.deleteUser(userId);

		if (deleteUserError) {
			throw deleteUserError;
		}

		// Clean up storage files after DB cascade completes
		if (documents && documents.length > 0) {
			for (const doc of documents) {
				const bucket = ["public_document", "default_document"].includes(
					doc.source_type,
				)
					? "public_documents"
					: "documents";

				try {
					await this.deleteFileFromStorage(doc.source_url, bucket);
				} catch (storageError) {
					captureError(storageError);
				}
			}
		}
	}

	/**
	 * Restore a soft-deleted user.
	 * Requires service role to update user_active_status.
	 */
	async restoreUser(userId: string): Promise<void> {
		const { error } = await this.client
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

		const { error } = await this.client.auth.admin.inviteUserByEmail(email, {
			data,
		});

		if (error) {
			throw error;
		}
	}

	async updateUserColumnValue(
		_userId: string,
		_columnName: string,
		_amount: number = 1,
	): Promise<void> {
		// No-op: Referenced by some services but guarded against if there is no user.
		throw new Error(
			"updateUserColumnValue should not be called on PrivilegedDbService. " +
				"Ensure userId is checked before calling this method.",
		);
	}
}
