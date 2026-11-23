import { describe, it, expect, beforeEach, vi } from "vitest";
import { useChatsStore } from "./use-chats-store";
import type { ChatWithMessages } from "../common";
import { useCurrentChatIdStore } from "./current-chat-id-store";
import { deleteChats as deleteChatsFromDb } from "../api/chat/delete-chats";
import { getChats as getChatsFromDb } from "../api/chat/get-chats";

vi.mock("../api/chat/delete-chats", () => ({ deleteChats: vi.fn() }));
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

describe("useChatsStore - deleteChats", () => {
	beforeEach(() => {
		vi.mocked(deleteChatsFromDb).mockReset();
		vi.mocked(getChatsFromDb).mockReset();
		useChatsStore.setState({ chats: [], hasMoreChats: true });
		useCurrentChatIdStore.setState({ currentChatId: null });
	});

	it("removes only the confirmed deletions when a batch partly fails", async () => {
		useChatsStore.setState({ chats: toChats([50, 40, 30, 20]) });
		vi.mocked(deleteChatsFromDb).mockResolvedValue({
			deletedChatIds: [40, 30],
			error: new Error("failed"),
		});

		await expect(
			useChatsStore.getState().deleteChats([40, 30, 20]),
		).rejects.toThrow("failed");

		expect(chatIdsInStore()).toEqual([50, 20]);
	});

	it("closes the current chat once it is confirmed deleted", async () => {
		useChatsStore.setState({ chats: toChats([50, 45]) });
		useCurrentChatIdStore.setState({ currentChatId: 45 });
		vi.mocked(deleteChatsFromDb).mockResolvedValue({
			deletedChatIds: [45],
			error: null,
		});

		await useChatsStore.getState().deleteChats([45]);

		expect(useCurrentChatIdStore.getState().currentChatId).toBeNull();
		expect(chatIdsInStore()).toEqual([50]);
	});

	it("leaves the chat list and current chat untouched when the deletion fails entirely", async () => {
		useChatsStore.setState({ chats: toChats([50, 45]) });
		useCurrentChatIdStore.setState({ currentChatId: 45 });
		vi.mocked(deleteChatsFromDb).mockResolvedValue({
			deletedChatIds: [],
			error: new Error("failed"),
		});

		await expect(useChatsStore.getState().deleteChats([45])).rejects.toThrow(
			"failed",
		);

		expect(useCurrentChatIdStore.getState().currentChatId).toBe(45);
		expect(chatIdsInStore()).toEqual([50, 45]);
	});

	it("discards a page fetched before a deletion committed, once it resolves after", async () => {
		useChatsStore.setState({ chats: toChats([50, 40, 30]) });
		let resolveApiGetChats: (chats: ChatWithMessages[]) => void = () => {};
		vi.mocked(getChatsFromDb).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveApiGetChats = resolve;
				}),
		);
		vi.mocked(deleteChatsFromDb).mockResolvedValue({
			deletedChatIds: [30],
			error: null,
		});

		const fetch = useChatsStore
			.getState()
			.getChatsFromDb(new AbortController().signal);
		await useChatsStore.getState().deleteChats([30]);

		expect(chatIdsInStore()).toEqual([50, 40]);

		resolveApiGetChats(toChats([30, 20]));
		await fetch;

		expect(chatIdsInStore()).toEqual([50, 40]);
	});

	it("loads the next page when a delete empties the list but more remain", async () => {
		useChatsStore.setState({ chats: toChats([50, 40]), hasMoreChats: true });
		vi.mocked(deleteChatsFromDb).mockResolvedValue({
			deletedChatIds: [50, 40],
			error: null,
		});
		vi.mocked(getChatsFromDb).mockResolvedValue(toChats([10]));

		vi.useFakeTimers();
		await useChatsStore.getState().deleteChats([50, 40]);
		await vi.runAllTimersAsync();
		vi.useRealTimers();

		expect(getChatsFromDb).toHaveBeenCalledWith(null, expect.anything());
		await vi.waitFor(() => expect(chatIdsInStore()).toEqual([10]));
	});

	it("does not fetch more when the deletion empties the list and none remain", async () => {
		useChatsStore.setState({ chats: toChats([50, 40]), hasMoreChats: false });
		vi.mocked(deleteChatsFromDb).mockResolvedValue({
			deletedChatIds: [50, 40],
			error: null,
		});

		vi.useFakeTimers();
		await useChatsStore.getState().deleteChats([50, 40]);
		await vi.runAllTimersAsync();
		vi.useRealTimers();

		expect(getChatsFromDb).not.toHaveBeenCalled();
	});
});
