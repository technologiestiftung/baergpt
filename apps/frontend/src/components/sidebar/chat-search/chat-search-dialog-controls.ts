export const chatSearchDialogId = "chat-search-dialog";

export function openChatSearchDialog() {
	return () =>
		(
			document.getElementById(chatSearchDialogId) as HTMLDialogElement
		).showModal();
}

export function closeChatSearchDialog() {
	return () =>
		(document.getElementById(chatSearchDialogId) as HTMLDialogElement).close();
}
