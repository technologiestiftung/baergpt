import { describe, it, expect, beforeEach, vi } from "vitest";
import { openChatFromSearch } from "./chat-search-utils";
import { useChatsStore } from "../../../store/use-chats-store";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store";
import { useAuthStore } from "../../../store/auth-store";
import { getMessages } from "../../../api/message/get-messages";
import { deleteAllChats as deleteAllChatsFromDb } from "../../../api/chat/delete-all-chats";
import type { Chat, ChatMessage } from "../../../common";

vi.mock("../../../api/message/get-messages", () => ({
	getMessages: vi.fn(),
}));
vi.mock("../../../api/chat/delete-all-chats", () => ({
	deleteAllChats: vi.fn(),
}));
vi.mock("./chat-search-dialog-controls", () => ({
	closeChatSearchDialog: vi.fn(),
}));

const chat = { id: 42, name: "Test chat" } as unknown as Chat;

describe("openChatFromSearch", () => {
	beforeEach(() => {
		vi.mocked(getMessages).mockReset();
		vi.mocked(deleteAllChatsFromDb).mockReset();
		useChatsStore.setState({ chats: [], hasMoreChats: true });
		useCurrentChatIdStore.setState({ currentChatId: null });
		useAuthStore.setState({
			session: { user: { id: "user-1" } },
		} as unknown as ReturnType<typeof useAuthStore.getState>);
	});

	it("does not sync a chat's messages back in once it was deleted while they were loading", async () => {
		let resolveMessages: (messages: ChatMessage[]) => void = () => {};
		vi.mocked(getMessages).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveMessages = resolve;
				}),
		);
		vi.mocked(deleteAllChatsFromDb).mockResolvedValue({ error: null });

		const opening = openChatFromSearch(chat);
		await useChatsStore.getState().deleteAllChats();

		resolveMessages([]);
		await opening;

		expect(useChatsStore.getState().chats).toEqual([]);
	});

	it("still syncs the chat's messages when no deletion happened while they were loading", async () => {
		vi.mocked(getMessages).mockResolvedValue([]);

		await openChatFromSearch(chat);

		expect(useChatsStore.getState().chats.map(({ id }) => id)).toEqual([42]);
		expect(useCurrentChatIdStore.getState().currentChatId).toBe(42);
	});
});
