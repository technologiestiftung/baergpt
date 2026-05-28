import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserDocumentStore } from "./use-user-document-store";
import { useChatsStore } from "./use-chats-store";

vi.mock("../api/documents/get-documents.ts", () => ({ getDocuments: vi.fn() }));
vi.mock("../api/documents/delete-document.ts", () => ({
	deleteDocument: vi.fn(),
}));
vi.mock("../api/documents/update-document-folder.ts", () => ({
	updateDocumentFolder: vi.fn(),
}));
vi.mock("../api/documents/hide-default-document.ts", () => ({
	hideDefaultDocument: vi.fn(),
}));
vi.mock("../api/documents/get-hidden-default-document-ids.ts", () => ({
	getHiddenDefaultDocumentIds: vi.fn(),
}));
vi.mock("./error-store.ts", () => ({
	useErrorStore: {
		getState: vi.fn(() => ({ handleError: vi.fn(), clearUIError: vi.fn() })),
	},
}));
vi.mock("./use-chats-store", () => ({
	useChatsStore: {
		getState: vi.fn(() => ({
			selectedChatOptions: [],
			toggleChatOption: vi.fn(),
			setExternalToolInfoMessage: vi.fn(),
		})),
	},
}));

describe("useUserDocumentStore selectUserChatDocument", () => {
	beforeEach(() => {
		useUserDocumentStore.setState({ selectedUserChatDocuments: [] });
	});

	it("deactivates parla and sets info message when a document is selected while parla is active", () => {
		const mockToggle = vi.fn();
		const mockSetInfo = vi.fn();
		vi.mocked(useChatsStore.getState).mockReturnValue({
			selectedChatOptions: ["parla"],
			toggleChatOption: mockToggle,
			setExternalToolInfoMessage: mockSetInfo,
		} as never);

		const doc = { id: 1, file_name: "test.pdf" } as never;
		useUserDocumentStore.getState().selectUserChatDocument(doc);

		expect(mockToggle).toHaveBeenCalledWith("parla");
		expect(mockSetInfo).toHaveBeenCalledWith("parla");
	});

	it("deactivates webSearch and sets info message when a document is selected while webSearch is active", () => {
		const mockToggle = vi.fn();
		const mockSetInfo = vi.fn();
		vi.mocked(useChatsStore.getState).mockReturnValue({
			selectedChatOptions: ["webSearch"],
			toggleChatOption: mockToggle,
			setExternalToolInfoMessage: mockSetInfo,
		} as never);

		const doc = { id: 2, file_name: "test.pdf" } as never;
		useUserDocumentStore.getState().selectUserChatDocument(doc);

		expect(mockToggle).toHaveBeenCalledWith("webSearch");
		expect(mockSetInfo).toHaveBeenCalledWith("webSearch");
	});

	it("does not deactivate anything when no external tool is active", () => {
		const mockToggle = vi.fn();
		const mockSetInfo = vi.fn();
		vi.mocked(useChatsStore.getState).mockReturnValue({
			selectedChatOptions: [],
			toggleChatOption: mockToggle,
			setExternalToolInfoMessage: mockSetInfo,
		} as never);

		const doc = { id: 3, file_name: "test.pdf" } as never;
		useUserDocumentStore.getState().selectUserChatDocument(doc);

		expect(mockToggle).not.toHaveBeenCalled();
		expect(mockSetInfo).not.toHaveBeenCalled();
	});
});
