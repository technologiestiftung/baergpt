import {
	type ReactNode,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
import Content from "../../../content.ts";
import { useChatScrollingStore } from "../../../store/use-chat-scrolling-store.ts";

export function CollapsiblePrompt({
	messageId,
	children,
}: {
	messageId: number;
	children: ReactNode;
}) {
	const isSearchTarget = useChatScrollingStore(
		(state) => state.pendingScrollToMessage?.messageId === messageId,
	);
	const [isExpanded, setIsExpanded] = useState(false);
	const [isOverflowing, setIsOverflowing] = useState(false);
	const bubbleRef = useRef<HTMLDivElement>(null);
	const clipRef = useRef<HTMLDivElement>(null);
	const contentId = useId();

	useLayoutEffect(() => {
		const clip = clipRef.current;
		if (isExpanded || !clip) {
			return () => {};
		}
		const measure = () =>
			setIsOverflowing(clip.scrollHeight > clip.clientHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(clip);
		// At max height the clip stops resizing, but its content doesn't.
		for (const child of Array.from(clip.children)) {
			observer.observe(child);
		}
		return () => observer.disconnect();
	}, [isExpanded]);

	useLayoutEffect(() => {
		if (isSearchTarget && isOverflowing) {
			setIsExpanded(true);
		}
	}, [isSearchTarget, isOverflowing]);

	const keepTopInView = () => {
		const { containerRef, adjustSpacer, updateIsAtBottom } =
			useChatScrollingStore.getState();
		const container = containerRef.current;
		const bubble = bubbleRef.current;
		if (!container || !bubble) {
			return;
		}
		// Before the scroll, so it isn't clamped to the shrunken content.
		adjustSpacer();
		const offset =
			bubble.getBoundingClientRect().top -
			container.getBoundingClientRect().top;
		if (offset < 0) {
			container.scrollTop += offset;
		}
		updateIsAtBottom();
	};

	const toggle = () => {
		if (!isExpanded) {
			setIsExpanded(true);
			return;
		}
		flushSync(() => setIsExpanded(false));
		keepTopInView();
	};

	return (
		<div
			ref={bubbleRef}
			className="bg-hellblau-30 px-4 py-1 rounded-3px w-fit max-w-[85%] md:max-w-[80%] text-dunkelblau-100"
		>
			<div
				ref={clipRef}
				id={contentId}
				className={
					isExpanded ? undefined : "overflow-clip max-h-collapsed-prompt"
				}
			>
				{children}
			</div>
			{isOverflowing && (
				<button
					type="button"
					onClick={toggle}
					aria-expanded={isExpanded}
					aria-controls={contentId}
					className="flex items-center gap-1.5 h-8 -ml-2 pl-2 pr-1.5 mt-2.5 mb-1 rounded-3px text-sm leading-5 font-normal text-dunkelblau-100 hover:bg-hellblau-50 focus-visible:outline-default"
				>
					{isExpanded
						? Content["chat.userMessage.showLess"]
						: Content["chat.userMessage.showMore"]}
					<span className="flex items-center justify-center shrink-0 size-4">
						<img
							src="/icons/chevron-down-icon.svg"
							alt=""
							width={10}
							height={6}
							className={isExpanded ? "rotate-180" : undefined}
						/>
					</span>
				</button>
			)}
		</div>
	);
}
