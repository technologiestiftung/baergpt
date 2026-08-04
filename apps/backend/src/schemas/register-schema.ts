import { z } from "zod";

export const registerSchema = z.object({
	email: z.string().min(1, "email is required"),
	password: z.string().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
