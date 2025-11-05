import Content from "../../../content.ts";

export function EyeIcon({
	variant = "default",
}: {
	variant: "default" | "struck-through";
}) {
	return (
		<div className="group/eyeIcon">
			<img
				src="/icons/eye-icon.svg"
				alt={Content["eyeIcon.imgAlt"]}
				width={24}
				height={24}
				className={`${variant === "default" ? "block group-hover/eyeIcon:hidden" : "hidden"}`}
			/>

			<img
				src="/icons/eye-hover-icon.svg"
				alt={Content["eyeIcon.imgAlt"]}
				width={24}
				height={24}
				className={`${variant === "default" ? "hidden group-hover/eyeIcon:block" : "hidden"}`}
			/>

			<img
				src="/icons/eye-struck-through-icon.svg"
				alt={Content["eyeStruckThroughIcon.imgAlt"]}
				width={24}
				height={24}
				className={`${variant === "struck-through" ? "block group-hover/eyeIcon:hidden" : "hidden"}`}
			/>

			<img
				src="/icons/eye-struck-through-hover-icon.svg"
				alt={Content["eyeStruckThroughIcon.imgAlt"]}
				width={24}
				height={24}
				className={`${variant === "struck-through" ? "hidden group-hover/eyeIcon:block" : "hidden"}`}
			/>
		</div>
	);
}
