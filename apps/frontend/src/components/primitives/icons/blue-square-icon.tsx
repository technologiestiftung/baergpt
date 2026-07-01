import Content from "../../../content.ts";

export function BlueSquareIcon() {
	return (
		<img
			src="/icons/blue-square-icon.svg"
			width={13}
			height={13}
			alt={Content["baerIcon.imgAlt"]}
			className="animate-shrink-grow size-4 rounded-sm"
		/>
	);
}
