export const chatSearchDialogId = "chat-search-dialog";

export function openChatSearchDialog() {
	(
		document.getElementById(chatSearchDialogId) as HTMLDialogElement
	).showModal();
}

export function closeChatSearchDialog() {
	(document.getElementById(chatSearchDialogId) as HTMLDialogElement).close();
}
