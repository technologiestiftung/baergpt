import Content from "../../../content";

type GreenCheckIconProps = {
	size?: "small" | "large";
};
export function GreenCheckIcon({ size = "large" }: GreenCheckIconProps) {
	return (
		<img
			src="/icons/green-check-icon.svg"
			width={size === "small" ? 20 : 24}
			height={size === "small" ? 20 : 24}
			alt={Content["greenCheckIcon.imgAlt"]}
		/>
	);
}
