import type { UserScopedDbClient } from "../../supabase";
import { BaseContentDbService } from "./base-db-service";
import { captureError } from "../../monitoring/capture-error";

export class UserScopedDbService extends BaseContentDbService {
	protected readonly client: UserScopedDbClient;

	constructor(client: UserScopedDbClient) {
		super();
		this.client = client;
	}
	async updateUserColumnValue(
		userId: string,
		columnName: string,
		amount: number = 1,
	): Promise<void> {
		const { error } = await this.client.rpc("change_value_for_user_by", {
			amount,
			column_name: columnName,
			user_id_to_update: userId,
		});

		if (error) {
			throw error;
		}
	}

	async updateUsage(userId: string, tokenAmount: number): Promise<void> {
		try {
			await this.updateUserColumnValue(
				userId,
				"num_inference_tokens",
				tokenAmount,
			);
			await this.updateUserColumnValue(userId, "num_inferences", 1);
		} catch (error) {
			captureError(error);
		}
	}
}
