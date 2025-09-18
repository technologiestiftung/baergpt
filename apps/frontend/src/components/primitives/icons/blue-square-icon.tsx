import Content from "../../../content.ts";

export function BlueSquareIcon() {
	return (
		<img
			src="/icons/blue-square-icon.svg"
			width={14}
			height={14}
			alt={Content["baerIcon.imgAlt"]}
			className="animate-shrink-grow size-4"
		/>
	);
}
