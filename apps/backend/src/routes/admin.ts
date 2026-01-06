import { Hono } from "hono";
import { PrivilegedDbService } from "../services/db-service/privileged-db-service";
import { adminAuth } from "../middleware/admin-auth";
import { captureError } from "../monitoring/capture-error";
import basicAuth from "../middleware/basic-auth";
import { serviceRoleDbClient } from "../supabase";

const admin = new Hono();
admin.use(basicAuth);
admin.use(adminAuth);

const serviceRoleAdminService = new PrivilegedDbService(serviceRoleDbClient);

// Route: update user profile (first_name, last_name, academic_title, email, personal_title)
admin.put("/users/:userId/profile", async (c) => {
	try {
		const userId = c.req.param("userId");
		if (!userId) {
			return c.json({ error: "User ID is required" }, 400);
		}

		const body = await c.req.json();

		const { firstName, lastName, academic_title, email, personal_title } = body;

		// At least one field is required
		if (
			!firstName &&
			!lastName &&
			!academic_title &&
			!personal_title &&
			!email
		) {
			return c.json(
				{
					error:
						"At least one field (firstName, lastName, academic_title, personal_title, or email) is required",
				},
				400,
			);
		}

		// Update profile fields (requires service role for auth.admin.updateUserById)
		await serviceRoleAdminService.updateUserProfile({
			userId,
			firstName,
			lastName,
			academic_title,
			email,
			personal_title,
		});

		return c.json({ message: "Profile updated successfully" });
	} catch (error) {
		captureError(error);

		if (error instanceof SyntaxError) {
			return c.json({ error: "Invalid JSON in request body" }, 400);
		}

		return c.json({ error: "Internal Server Error" }, 500);
	}
});

// Route for updating user admin status
admin.put("/users/:userId/admin", async (c) => {
	try {
		const userId = c.req.param("userId");
		if (!userId) {
			return c.json({ error: "User ID is required" }, 400);
		}
		const { isAdmin } = await c.req.json();
		if (typeof isAdmin !== "boolean") {
			return c.json({ error: "isAdmin must be a boolean value" }, 400);
		}

		await serviceRoleAdminService.updateUserAdminStatus(userId, isAdmin);
		return c.json({ message: "User admin status updated successfully" });
	} catch (error) {
		captureError(error);

		if (error instanceof SyntaxError) {
			return c.json({ error: "Invalid JSON in request body" }, 400);
		}

		return c.json({ error: "Internal Server Error" }, 500);
	}
});

// Route for deleting a user (soft delete by default, hard delete if specified)
admin.delete("/users/:userId", async (c) => {
	try {
		const userId = c.req.param("userId");
		if (!userId) {
			return c.json({ error: "User ID is required" }, 400);
		}

		// Check if hard delete is requested via query parameter
		const hardDelete = c.req.query("hard") === "true";

		if (hardDelete) {
			await serviceRoleAdminService.hardDeleteUser(userId);
			return c.json({ message: "User permanently deleted successfully" });
		}

		await serviceRoleAdminService.softDeleteUser(userId);
		return c.json({ message: "User soft deleted successfully" });
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

// Route for restoring a soft-deleted user
admin.put("/users/:userId/restore", async (c) => {
	try {
		const userId = c.req.param("userId");
		if (!userId) {
			return c.json({ error: "User ID is required" }, 400);
		}

		await serviceRoleAdminService.restoreUser(userId);
		return c.json({ message: "User restored successfully" });
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

// Route for sending an invite link to a user
admin.post("/users/invite", async (c) => {
	try {
		const { email, firstName, lastName } = await c.req.json();
		if (!email) {
			return c.json({ error: "Email is required" }, 400);
		}

		await serviceRoleAdminService.sendInviteLink(email, firstName, lastName);
		return c.json({ message: "Invite link sent successfully" });
	} catch (error) {
		captureError(error);

		if (error instanceof SyntaxError) {
			return c.json({ error: "Invalid JSON in request body" }, 400);
		}

		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default admin;
