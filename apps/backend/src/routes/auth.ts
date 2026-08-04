import { Hono } from "hono";
import { ZodError } from "zod";
import { RegistrationService } from "../services/registration-service";
import { registerSchema } from "../schemas/register-schema";
import { captureError } from "../monitoring/capture-error";
import { serviceRoleDbClient } from "../supabase";

const auth = new Hono();

const registrationService = new RegistrationService(serviceRoleDbClient);

auth.post("/register", async (c) => {
	try {
		const body = await c.req.json();
		const { email, password, firstName, lastName } = registerSchema.parse(body);

		await registrationService.registerOrRecover({
			email,
			password,
			firstName,
			lastName,
		});

		return c.json({ message: "ok" });
	} catch (error) {
		captureError(error);

		if (error instanceof ZodError) {
			const errors = error.issues
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("; ");
			return c.json({ error: `Validation failed: ${errors}` }, 400);
		}

		if (error instanceof SyntaxError) {
			return c.json({ error: "Invalid JSON in request body" }, 400);
		}

		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default auth;
