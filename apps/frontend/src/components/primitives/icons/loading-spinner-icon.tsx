import Content from "../../../content";

export function LoadingSpinnerIcon({
	variant = "default",
	size = "large",
}: {
	variant?: "default" | "disabled" | "light";
	size?: "small" | "large";
}) {
	return (
		<div className="flex items-center justify-center p-0.5">
			<img
				src="/icons/spinner-icon.svg"
				width={size === "small" ? 16 : 24}
				height={size === "small" ? 16 : 24}
				alt={Content["loadingSpinnerIcon.imgAlt"]}
				className={`${variant === "default" ? "block" : "hidden"} animate-spin`}
			/>

			<img
				src="/icons/spinner-icon-light.svg"
				width={16}
				height={16}
				alt={Content["loadingSpinnerIcon.imgAlt"]}
				className={`${variant === "light" ? "block" : "hidden"} animate-spin`}
			/>

			<img
				src="/icons/spinner-icon-disabled.svg"
				width={size === "small" ? 16 : 24}
				height={size === "small" ? 16 : 24}
				alt={Content["loadingSpinnerIcon.imgAlt"]}
				className={`${variant === "disabled" ? "block" : "hidden"} animate-spin`}
			/>
		</div>
	);
}
