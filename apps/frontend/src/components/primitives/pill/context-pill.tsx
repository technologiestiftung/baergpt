import type { ChatOption } from "../../../common";
import Content from "../../../content";

interface ContextPillProps {
	option: ChatOption;
	onClose: () => void;
}

export function ContextPill({ option, onClose }: ContextPillProps) {
	const label = Content[
		`chat.contextPill.${option.toLowerCase()}.label` as keyof typeof Content
	] as string;

	return (
		<button
			type="button"
			onClick={onClose}
			className={`flex items-center gap-x-1 rounded-full px-2 py-1 focus-visible:outline-default bg-hellblau-30 hover:bg-hellblau-55 text-aktiv-blau-100`}
			data-option={option}
			aria-label={`${label} ${Content["chat.contextPill.ariaLabel"]}`}
		>
			<img
				src={`/icons/${option.toLowerCase()}-icon.svg`}
				alt={`${option.toLowerCase()}-icon`}
				className="h-[14px] w-[12px] shrink-0 relative"
			/>
			<p className="text-sm leading-5 font-normal whitespace-nowrap shrink-0 relative">
				{label}
			</p>
			<img src="/icons/blue-close-icon.svg" alt="" className="h-4 w-4" />
		</button>
	);
}
