import Content from "../../../content.ts";

export function BaerIcon({ className }: { className?: string }) {
	return (
		<img
			src="/icons/baer-icon.svg"
			width={19}
			height={21}
			alt={Content["baerIcon.imgAlt"]}
			className={`${className}`}
		/>
	);
}
