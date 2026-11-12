import { describe, it, expect, beforeEach } from "vitest";
import { useHistorySelectionStore } from "./use-history-selection-store";
import { useChatsStore } from "./use-chats-store";
import { useCurrentChatIdStore } from "./current-chat-id-store";
import type { ChatWithMessages } from "../common";

const chatIds = [50, 40, 30, 20, 10];

describe("useHistorySelectionStore", () => {
	beforeEach(() => {
		useChatsStore.setState({
			chats: chatIds.map((id) => ({ id }) as ChatWithMessages),
		});
		useCurrentChatIdStore.setState({ currentChatId: null });
		useHistorySelectionStore.getState().clearSelection();
	});

	it("selects the range between the current chat and the clicked chat", () => {
		useCurrentChatIdStore.setState({ currentChatId: 40 });

		useHistorySelectionStore.getState().selectRangeTo(20);

		expect(useHistorySelectionStore.getState().selectedChatIds).toEqual([
			40, 30, 20,
		]);
	});

	it("selects upwards from the anchor", () => {
		useCurrentChatIdStore.setState({ currentChatId: 20 });

		useHistorySelectionStore.getState().selectRangeTo(50);

		expect(useHistorySelectionStore.getState().selectedChatIds).toEqual([
			50, 40, 30, 20,
		]);
	});

	it("keeps the anchor when the range is changed", () => {
		useCurrentChatIdStore.setState({ currentChatId: 30 });
		const { selectRangeTo } = useHistorySelectionStore.getState();

		selectRangeTo(10);
		selectRangeTo(40);

		expect(useHistorySelectionStore.getState().selectedChatIds).toEqual([
			40, 30,
		]);
	});

	it("only sets the anchor when no range can be formed", () => {
		useHistorySelectionStore.getState().selectRangeTo(30);

		expect(useHistorySelectionStore.getState().selectedChatIds).toEqual([]);
		expect(useHistorySelectionStore.getState().anchorChatId).toBe(30);

		useHistorySelectionStore.getState().selectRangeTo(10);

		expect(useHistorySelectionStore.getState().selectedChatIds).toEqual([
			30, 20, 10,
		]);
	});

	it("ignores chats that are no longer in the list", () => {
		useCurrentChatIdStore.setState({ currentChatId: 40 });

		useHistorySelectionStore.getState().selectRangeTo(999);

		expect(useHistorySelectionStore.getState().selectedChatIds).toEqual([]);
	});

	it("clears the selection when the current chat changes", () => {
		useCurrentChatIdStore.setState({ currentChatId: 40 });
		useHistorySelectionStore.getState().selectRangeTo(20);

		useCurrentChatIdStore.setState({ currentChatId: 10 });

		expect(useHistorySelectionStore.getState().selectedChatIds).toEqual([]);
	});

	it("clears the selection", () => {
		useCurrentChatIdStore.setState({ currentChatId: 50 });
		useHistorySelectionStore.getState().selectRangeTo(30);

		useHistorySelectionStore.getState().clearSelection();

		expect(useHistorySelectionStore.getState().selectedChatIds).toEqual([]);
		expect(useHistorySelectionStore.getState().anchorChatId).toBeNull();
	});
});
