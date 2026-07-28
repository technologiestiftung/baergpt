import { Hono } from "hono";
import { RegistrationService } from "../services/registration-service";
import { captureError } from "../monitoring/capture-error";
import { serviceRoleDbClient } from "../supabase";

const auth = new Hono();

const registrationService = new RegistrationService(serviceRoleDbClient);

auth.post("/register", async (c) => {
	try {
		const body = await c.req.json();
		const { email, password, firstName, lastName } = body;

		if (!email) {
			return c.json({ error: "email is required" }, 400);
		}

		await registrationService.registerOrRecover({
			email,
			password,
			firstName,
			lastName,
		});

		return c.json({ message: "ok" });
	} catch (error) {
		captureError(error);

		if (error instanceof SyntaxError) {
			return c.json({ error: "Invalid JSON in request body" }, 400);
		}

		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default auth;
