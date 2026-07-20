import Content from "../../../content.ts";

export function ParlaIcon() {
	return (
		<img
			src={`/icons/parla-logo-icon.svg`}
			height={14}
			alt={Content["chat.contextPill.parla.icon.alt"]}
			className="w-[14px] shrink-0 relative"
		/>
	);
}
