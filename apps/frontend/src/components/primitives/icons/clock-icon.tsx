import Content from "../../../content";

type ClockIconProps = {
	size?: "small" | "large";
};
export function ClockIcon({ size = "large" }: ClockIconProps) {
	return (
		<img
			src="/icons/clock-icon.svg"
			width={size === "small" ? 20 : 24}
			height={size === "small" ? 20 : 24}
			alt={Content["clockIcon.imgAlt"]}
		/>
	);
}
