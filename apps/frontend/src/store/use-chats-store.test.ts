import { describe, it, expect, beforeEach } from "vitest";
import { useChatsStore } from "./use-chats-store";

describe("useChatsStore - Datawrapper integration", () => {
	beforeEach(() => {
		useChatsStore.getState().resetToDefaultChatTools();
	});

	it("allows toggling datawrapper connector tool", () => {
		const store = useChatsStore.getState();
		expect(store.selectedChatTools).not.toContain("datawrapper");

		store.toggleChatTool("datawrapper");
		expect(useChatsStore.getState().selectedChatTools).toContain("datawrapper");

		store.toggleChatTool("datawrapper");
		expect(useChatsStore.getState().selectedChatTools).not.toContain(
			"datawrapper",
		);
	});

	it("deactivates datawrapper when deactivateExternalTools is called", () => {
		const store = useChatsStore.getState();
		store.toggleChatTool("datawrapper");
		expect(useChatsStore.getState().selectedChatTools).toContain("datawrapper");

		useChatsStore.getState().deactivateExternalTools();
		expect(useChatsStore.getState().selectedChatTools).not.toContain(
			"datawrapper",
		);
		expect(useChatsStore.getState().autoDeactivatedExternalTools).toContain(
			"datawrapper",
		);
	});
});
