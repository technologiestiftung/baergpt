interface WebSearchIconProps {
	width?: number;
	height?: number;
	variant?: "default" | "active";
}

export function WebSearchIcon({
	width = 14,
	height = 14,
	variant = "default",
}: WebSearchIconProps) {
	return (
		<div>
			<img
				src="/icons/web-search-icon.svg"
				alt="Web search"
				width={width}
				height={height}
				className={`${variant === "default" ? "block" : "hidden"}`}
			/>
			<img
				src="/icons/web-search-icon-blue.svg"
				alt="Web search"
				width={width}
				height={height}
				className={`${variant === "active" ? "block" : "hidden"}`}
			/>
		</div>
	);
}
