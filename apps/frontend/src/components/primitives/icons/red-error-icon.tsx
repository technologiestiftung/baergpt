import Content from "../../../content";

type RedErrorIconProps = {
	size?: "small" | "large";
};
export function RedErrorIcon({ size = "large" }: RedErrorIconProps) {
	return (
		<img
			src="/icons/error-icon.svg"
			width={size === "small" ? 20 : 24}
			height={size === "small" ? 20 : 24}
			alt={Content["redErrorIcon.imgAlt"]}
		/>
	);
}
