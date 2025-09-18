import { supabase } from "../../../supabase-client.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { Chat } from "../../common.ts";

export async function insertChat(name: string) {
	const session = useAuthStore.getState().session;
	if (!session?.user?.id) {
		throw new Error("User not authenticated");
	}
	const userId = session.user.id;

	const { data, error } = await supabase
		.from("chats")
		.insert({
			user_id: userId,
			created_at: new Date(),
			name,
		})
		.select("*")
		.returns<Chat[]>();

	if (error) {
		throw new Error(error.message);
	}

	return data[0];
}
