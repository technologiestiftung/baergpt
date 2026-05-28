import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatsStore } from "./use-chats-store";
import { useUserDocumentStore } from "./use-user-document-store";

vi.mock("../api/chat/get-chats.ts", () => ({ getChats: vi.fn() }));
vi.mock("../api/chat/insert-chat.ts", () => ({ insertChat: vi.fn() }));
vi.mock("../api/chat/delete-chat.ts", () => ({ deleteChat: vi.fn() }));
vi.mock("../api/chat/get-total-chat-count.ts", () => ({
	getTotalChatCount: vi.fn(),
}));
vi.mock("../api/message/get-messages.ts", () => ({ getMessages: vi.fn() }));
vi.mock("../api/message/insert-message.ts", () => ({ insertMessage: vi.fn() }));
vi.mock("../api/message/update-message.ts", () => ({ updateMessage: vi.fn() }));
vi.mock("./current-chat-id-store.ts", () => ({
	useCurrentChatIdStore: {
		getState: vi.fn(() => ({ currentChatId: null, setCurrentChatId: vi.fn() })),
	},
}));
vi.mock("./error-store.ts", () => ({
	useErrorStore: {
		getState: vi.fn(() => ({ handleError: vi.fn(), clearUIError: vi.fn() })),
	},
}));
vi.mock("./use-user-document-store", () => ({
	useUserDocumentStore: {
		getState: vi.fn(() => ({
			selectedUserChatDocuments: [],
			unselectUserChatDocument: vi.fn(),
		})),
	},
}));
vi.mock("./use-user-folder-store.ts", () => ({
	useUserFolderStore: {
		getState: vi.fn(() => ({
			selectedUserChatFolders: [],
			unselectUserChatFolder: vi.fn(),
		})),
	},
}));
vi.mock("./use-public-documents-store.ts", () => ({
	usePublicDocumentsStore: {
		getState: vi.fn(() => ({
			selectedPublicChatDocuments: [],
			selectedPublicChatFolders: [],
			unselectPublicChatDocument: vi.fn(),
			unselectPublicChatFolder: vi.fn(),
		})),
	},
}));

describe("useChatsStore", () => {
	beforeEach(() => {
		vi.clearAllTimers();
		useChatsStore.setState({
			selectedChatOptions: [],
			externalToolInfoMessage: null,
		});
	});

	describe("toggleChatOption", () => {
		it("deselects all documents when activating webSearch", () => {
			const mockUnselectUserChatDocument = vi.fn();
			vi.mocked(useUserDocumentStore.getState).mockReturnValue({
				selectedUserChatDocuments: [{ id: 1 } as never],
				unselectUserChatDocument: mockUnselectUserChatDocument,
			} as never);

			useChatsStore.getState().toggleChatOption("webSearch");

			expect(mockUnselectUserChatDocument).toHaveBeenCalledWith(1);
		});

		it("deselects all documents when activating parla", () => {
			const mockUnselectUserChatDocument = vi.fn();
			vi.mocked(useUserDocumentStore.getState).mockReturnValue({
				selectedUserChatDocuments: [{ id: 42 } as never],
				unselectUserChatDocument: mockUnselectUserChatDocument,
			} as never);

			useChatsStore.getState().toggleChatOption("parla");

			expect(mockUnselectUserChatDocument).toHaveBeenCalledWith(42);
		});

		it("does not deselect documents when deactivating webSearch", () => {
			const mockUnselectUserChatDocument = vi.fn();
			vi.mocked(useUserDocumentStore.getState).mockReturnValue({
				selectedUserChatDocuments: [{ id: 1 } as never],
				unselectUserChatDocument: mockUnselectUserChatDocument,
			} as never);

			useChatsStore.setState({ selectedChatOptions: ["webSearch"] });
			useChatsStore.getState().toggleChatOption("webSearch");

			expect(mockUnselectUserChatDocument).not.toHaveBeenCalled();
		});
	});

	describe("setExternalToolInfoMessage", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("sets the tool when called with a ChatOption", () => {
			useChatsStore.getState().setExternalToolInfoMessage("parla");

			expect(useChatsStore.getState().externalToolInfoMessage).toBe("parla");
		});

		it("clears the message when called with null", () => {
			useChatsStore.setState({ externalToolInfoMessage: "parla" });

			useChatsStore.getState().setExternalToolInfoMessage(null);

			expect(useChatsStore.getState().externalToolInfoMessage).toBeNull();
		});

		it("auto-clears after 12 seconds", () => {
			useChatsStore.getState().setExternalToolInfoMessage("webSearch");
			expect(useChatsStore.getState().externalToolInfoMessage).toBe(
				"webSearch",
			);

			vi.runAllTimers();
			expect(useChatsStore.getState().externalToolInfoMessage).toBeNull();
		});
	});
});
