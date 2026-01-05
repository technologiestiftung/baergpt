import { Content } from "../../../content";

type ContextPillType = "baseknowledge" | "websearch";

interface ContextPillProps {
	type: ContextPillType;
	onClose: () => void;
	label: string;
}

export function ContextPill({ type, onClose, label }: ContextPillProps) {
	return (
		<button
			type="button"
			tabIndex={0}
			onClick={onClose}
			className={`flex items-center gap-x-1 rounded-full px-2 py-1 focus-visible:outline-default bg-hellblau-30 hover:bg-hellblau-55 text-aktiv-blau-100`}
			data-type={type}
			aria-label={`${label} ${Content["chat.contextPill.ariaLabel"]}`}
		>
			<img
				src={`/icons/${type}-icon.svg`}
				alt=""
				className="h-[14px] w-[12px] shrink-0 relative"
			/>
			<p className="text-sm leading-5 font-normal whitespace-nowrap shrink-0 relative">
				{label}
			</p>
			<img src="/icons/blue-close-icon.svg" alt="" className="h-4 w-4" />
		</button>
	);
}
