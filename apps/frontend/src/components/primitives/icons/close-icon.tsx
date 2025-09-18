import Content from "../../../content";

export function CloseIcon({
	className,
	variant = "blue",
}: {
	className?: string;
	variant?: "blue" | "white" | "darkBlue";
}) {
	return (
		<>
			<img
				src="/icons/blue-x-icon.svg"
				width={24}
				height={24}
				alt={Content["closeIcon.imgAlt"]}
				className={`${className} ${variant === "blue" ? "block" : "hidden"}`}
			/>
			<img
				src="icons/white-x-icon.svg"
				width={24}
				height={24}
				alt={Content["closeIcon.imgAlt"]}
				className={`${className} ${variant === "white" ? "block" : "hidden"}`}
			/>
			<img
				src="icons/dark-blue-x-icon.svg"
				width={24}
				height={24}
				alt={Content["closeIcon.imgAlt"]}
				className={`${className} ${
					variant === "darkBlue" ? "block" : "hidden"
				}`}
			/>
		</>
	);
}
