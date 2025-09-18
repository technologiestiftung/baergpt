import Content from "../../../content";

export function AddToChatIcon({
	size = 24,
	variant,
}: {
	size?: number;
	variant: "plus-light" | "plus-dark" | "minus";
}) {
	return (
		<>
			<img
				src="/icons/add-to-chat-light-icon.svg"
				width={size}
				height={size}
				alt={Content["addToChatIcon.add.imgAlt"]}
				className={variant === "plus-light" ? "block" : "hidden"}
			/>

			<img
				src="/icons/add-to-chat-dark-icon.svg"
				width={size}
				height={size}
				alt={Content["addToChatIcon.add.imgAlt"]}
				className={variant === "plus-dark" ? "block" : "hidden"}
			/>

			<img
				src="/icons/remove-from-chat-icon.svg"
				width={size}
				height={size}
				alt={Content["addToChatIcon.remove.imgAlt"]}
				className={variant === "minus" ? "block" : "hidden"}
			/>
		</>
	);
}
