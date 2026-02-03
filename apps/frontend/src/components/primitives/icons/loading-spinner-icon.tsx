import Content from "../../../content";

export function LoadingSpinnerIcon({
	variant = "default",
	size = "large",
}: {
	variant?: "default" | "disabled";
	size?: "small" | "large";
}) {
	return (
		<>
			<img
				src="/icons/spinner-icon.svg"
				width={size === "small" ? 20 : 24}
				height={size === "small" ? 20 : 24}
				alt={Content["loadingSpinnerIcon.imgAlt"]}
				className={`${variant === "default" ? "block" : "hidden"} animate-spin`}
			/>

			<img
				src="/icons/spinner-icon-disabled.svg"
				width={size === "small" ? 20 : 24}
				height={size === "small" ? 20 : 24}
				alt={Content["loadingSpinnerIcon.imgAlt"]}
				className={`${variant === "disabled" ? "block" : "hidden"} animate-spin`}
			/>
		</>
	);
}
