import type { ServiceRoleDbClient } from "../supabase";
import { captureError } from "../monitoring/capture-error";

export class RegistrationService {
	private readonly client: ServiceRoleDbClient;

	constructor(client: ServiceRoleDbClient) {
		this.client = client;
	}

	/**
	 * Thrown exceptions (network failures, unexpected errors) propagate, since a
	 * 5xx doesn't reveal which branch was attempted. But the `error` GoTrue
	 * returns (not throws) from signUp/resend/resetPasswordForEmail can be
	 * state-correlated, e.g. signUp() returning "User already registered"
	 * because someone else registered the same email in the gap between our
	 * check and this call. So those stay swallowed and captured instead.
	 */
	async registerOrRecover({
		email,
		password,
		firstName,
		lastName,
	}: {
		email: string;
		password?: string;
		firstName?: string;
		lastName?: string;
	}): Promise<void> {
		const { data, error } = await this.client.rpc(
			"check_email_registration_status",
			{ p_email: email },
		);

		if (error) {
			throw error;
		}

		const status = data?.[0];

		if (!status?.user_exists) {
			if (!password) {
				captureError(
					new Error(
						"registerOrRecover called without a password for an email that doesn't exist yet; cannot create user",
					),
				);
				return;
			}

			const { error: signUpError } = await this.client.auth.signUp({
				email,
				password,
				options: {
					data: { first_name: firstName, last_name: lastName },
				},
			});

			if (signUpError) {
				captureError(signUpError);
			}

			return;
		}

		if (status.is_confirmed) {
			const { error: resetError } =
				await this.client.auth.resetPasswordForEmail(email);

			if (resetError) {
				captureError(resetError);
			}

			return;
		}

		const { error: resendError } = await this.client.auth.resend({
			type: "signup",
			email,
		});

		if (resendError) {
			captureError(resendError);
		}
	}
}
