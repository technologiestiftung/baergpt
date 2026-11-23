import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatsStore } from "./use-chats-store";
import type { ChatWithMessages } from "../common";
import { useCurrentChatIdStore } from "./current-chat-id-store";
import { useAuthStore } from "./auth-store";
import { deleteAllChats as deleteAllChatsFromDb } from "../api/chat/delete-all-chats";
import { getChats as getChatsFromDb } from "../api/chat/get-chats";

vi.mock("../api/chat/delete-all-chats", () => ({
	deleteAllChats: vi.fn(),
}));
vi.mock("../api/chat/get-chats", () => ({
	getChats: vi.fn(),
	CHATS_PAGE_SIZE: 20,
}));
vi.mock("../api/message/get-messages", () => ({
	getMessages: vi.fn().mockResolvedValue([]),
}));

const toChats = (ids: number[]) =>
	ids.map((id) => ({ id, messages: [] }) as unknown as ChatWithMessages);

const chatIdsInStore = () => useChatsStore.getState().chats.map(({ id }) => id);

describe("useChatsStore - deleteAllChats", () => {
	beforeEach(() => {
		vi.mocked(deleteAllChatsFromDb).mockReset();
		vi.mocked(getChatsFromDb).mockReset();
		useChatsStore.setState({ chats: [], hasMoreChats: true });
		useCurrentChatIdStore.setState({ currentChatId: null });
		useAuthStore.setState({
			session: { user: { id: "user-1" } },
		} as unknown as ReturnType<typeof useAuthStore.getState>);
	});

	it("waits for the request to resolve before clearing the chat list", async () => {
		useChatsStore.setState({ chats: toChats([50, 45]) });
		useCurrentChatIdStore.setState({ currentChatId: 45 });
		let resolveDelete: (result: { error: Error | null }) => void = () => {};
		vi.mocked(deleteAllChatsFromDb).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveDelete = resolve;
				}),
		);

		const deletion = useChatsStore.getState().deleteAllChats();

		expect(chatIdsInStore()).toEqual([50, 45]);
		expect(useCurrentChatIdStore.getState().currentChatId).toBe(45);

		resolveDelete({ error: null });
		await deletion;

		expect(deleteAllChatsFromDb).toHaveBeenCalledWith("user-1");
		expect(chatIdsInStore()).toEqual([]);
		expect(useCurrentChatIdStore.getState().currentChatId).toBeNull();
		expect(useChatsStore.getState().hasMoreChats).toBe(false);
	});

	it("leaves the chat list and current chat untouched when the deletion fails", async () => {
		useChatsStore.setState({ chats: toChats([50, 45]) });
		useCurrentChatIdStore.setState({ currentChatId: 45 });
		vi.mocked(deleteAllChatsFromDb).mockResolvedValue({
			error: new Error("failed"),
		});

		await expect(useChatsStore.getState().deleteAllChats()).rejects.toThrow(
			"failed",
		);

		expect(chatIdsInStore()).toEqual([50, 45]);
		expect(useCurrentChatIdStore.getState().currentChatId).toBe(45);
	});

	it("discards a page fetched before the deletion committed, once it resolves after", async () => {
		useChatsStore.setState({ chats: toChats([50, 40]) });
		let resolveApiGetChats: (chats: ChatWithMessages[]) => void = () => {};
		vi.mocked(getChatsFromDb).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveApiGetChats = resolve;
				}),
		);
		vi.mocked(deleteAllChatsFromDb).mockResolvedValue({ error: null });

		const fetch = useChatsStore
			.getState()
			.getChatsFromDb(new AbortController().signal);
		await useChatsStore.getState().deleteAllChats();

		expect(chatIdsInStore()).toEqual([]);

		resolveApiGetChats(toChats([40, 30]));
		await fetch;

		expect(chatIdsInStore()).toEqual([]);
	});

	it("throws if there is no authenticated user, without touching the chat list", async () => {
		useChatsStore.setState({ chats: toChats([50]) });
		useAuthStore.setState({ session: null });

		await expect(useChatsStore.getState().deleteAllChats()).rejects.toThrow(
			"User not authenticated",
		);
		expect(deleteAllChatsFromDb).not.toHaveBeenCalled();
		expect(chatIdsInStore()).toEqual([50]);
	});
});
