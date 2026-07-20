import Content from "../../../content";

type GreyXIconProps = {
	size?: "small" | "large";
};
export function GreyXIcon({ size = "large" }: GreyXIconProps) {
	return (
		<img
			src="/icons/grey-x-icon.svg"
			width={size === "small" ? 20 : 24}
			height={size === "small" ? 20 : 24}
			alt={Content["greyXIcon.imgAlt"]}
		/>
	);
}
