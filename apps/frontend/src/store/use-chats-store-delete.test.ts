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

	it("reopens the current chat when its deletion fails", async () => {
		useChatsStore.setState({ chats: toChats([50, 45]) });
		useCurrentChatIdStore.setState({ currentChatId: 45 });
		vi.mocked(deleteChatsFromDb).mockResolvedValue({
			deletedChatIds: [],
			error: new Error("failed"),
		});

		const deletion = useChatsStore.getState().deleteChats([45]);
		expect(useCurrentChatIdStore.getState().currentChatId).toBeNull();

		await expect(deletion).rejects.toThrow("failed");
		expect(useCurrentChatIdStore.getState().currentChatId).toBe(45);
	});

	it("keeps a chat opened while the failed deletion was in flight", async () => {
		useChatsStore.setState({ chats: toChats([50, 45]) });
		useCurrentChatIdStore.setState({ currentChatId: 45 });
		vi.mocked(deleteChatsFromDb).mockImplementation(async () => {
			useCurrentChatIdStore.setState({ currentChatId: 50 });
			return { deletedChatIds: [], error: new Error("failed") };
		});

		await expect(useChatsStore.getState().deleteChats([45])).rejects.toThrow(
			"failed",
		);
		expect(useCurrentChatIdStore.getState().currentChatId).toBe(50);
	});

	it("restores only chats that were not deleted and not already present", async () => {
		useChatsStore.setState({ chats: toChats([50, 40, 30, 20]) });
		vi.mocked(deleteChatsFromDb).mockImplementation(async () => {
			useChatsStore.setState({
				chats: [...useChatsStore.getState().chats, ...toChats([30])],
			});
			return { deletedChatIds: [40], error: new Error("failed") };
		});

		await expect(
			useChatsStore.getState().deleteChats([40, 30, 20]),
		).rejects.toThrow("failed");

		expect(chatIdsInStore()).toEqual([50, 30, 20]);
	});

	it("drops deleted chats from pages fetched while the deletion is in flight", async () => {
		useChatsStore.setState({ chats: toChats([50, 40, 30]) });
		let finishDeletion: () => void = () => {};
		vi.mocked(deleteChatsFromDb).mockImplementation(
			() =>
				new Promise((resolve) => {
					finishDeletion = () => resolve({ deletedChatIds: [30], error: null });
				}),
		);
		vi.mocked(getChatsFromDb).mockResolvedValue(toChats([30, 20]));

		const deletion = useChatsStore.getState().deleteChats([30]);
		await useChatsStore.getState().getChatsFromDb(new AbortController().signal);
		finishDeletion();
		await deletion;

		expect(chatIdsInStore()).toEqual([50, 40, 20]);
	});

	it("pauses pagination on an empty list until the deletion is done", async () => {
		useChatsStore.setState({ chats: toChats([50, 40]) });
		let finishDeletion: () => void = () => {};
		vi.mocked(deleteChatsFromDb).mockImplementation(
			() =>
				new Promise((resolve) => {
					finishDeletion = () =>
						resolve({ deletedChatIds: [50, 40], error: null });
				}),
		);
		vi.mocked(getChatsFromDb).mockResolvedValue(toChats([10]));

		const deletion = useChatsStore.getState().deleteChats([50, 40]);
		await useChatsStore.getState().getChatsFromDb(new AbortController().signal);

		expect(getChatsFromDb).not.toHaveBeenCalled();

		vi.useFakeTimers();
		finishDeletion();
		await deletion;
		await vi.runAllTimersAsync();
		vi.useRealTimers();

		expect(getChatsFromDb).toHaveBeenCalledWith(null, expect.anything());
		await vi.waitFor(() => expect(chatIdsInStore()).toEqual([10]));
	});
});
