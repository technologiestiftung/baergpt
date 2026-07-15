import Content from "../../content";
import { useChatScrollingStore } from "../../store/use-chat-scrolling-store";

export const ChatScrollButton = () => {
	const scrollToBottom = useChatScrollingStore((state) => state.scrollToBottom);
	return (
		<button
			type="button"
			onClick={() => scrollToBottom()}
			className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white shadow-md focus-visible:outline-2px"
			aria-label={Content["chat.scrollToBottomButton.ariaLabel"]}
		>
			<img
				src="/icons/scroll-icon.svg"
				alt=""
				aria-hidden="true"
				className="size-8"
			/>
		</button>
	);
};
