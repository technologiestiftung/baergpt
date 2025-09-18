import Content from "../../../content";

export function LoadingSpinnerIcon({
	variant = "default",
}: {
	variant?: "default" | "disabled";
}) {
	return (
		<>
			<img
				src="/icons/spinner-icon.svg"
				width={20}
				height={20}
				alt={Content["loadingSpinnerIcon.imgAlt"]}
				className={`${variant === "default" ? "block" : "hidden"} animate-spin`}
			/>

			<img
				src="/icons/spinner-icon-disabled.svg"
				width={20}
				height={20}
				alt={Content["loadingSpinnerIcon.imgAlt"]}
				className={`${variant === "disabled" ? "block" : "hidden"} animate-spin`}
			/>
		</>
	);
}
