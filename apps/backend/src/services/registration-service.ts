import type { ServiceRoleDbClient } from "../supabase";
import { captureError } from "../monitoring/capture-error";

export class RegistrationService {
	private readonly client: ServiceRoleDbClient;

	constructor(client: ServiceRoleDbClient) {
		this.client = client;
	}

	/**
	 * Internal failures are captured via Sentry and swallowed so the
	 * caller always sees the same generic response, regardless of which branch ran
	 * or whether a step failed.
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
		try {
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
					throw signUpError;
				}

				return;
			}

			if (status.is_confirmed) {
				const { error: resetError } =
					await this.client.auth.resetPasswordForEmail(email);

				if (resetError) {
					throw resetError;
				}

				return;
			}

			const { error: resendError } = await this.client.auth.resend({
				type: "signup",
				email,
			});

			if (resendError) {
				throw resendError;
			}
		} catch (error) {
			captureError(error);
		}
	}
}
