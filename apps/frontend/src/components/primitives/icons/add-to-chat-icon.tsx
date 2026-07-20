import Content from "../../../content";

export function AddToChatIcon({ size = 24 }: { size?: number }) {
	return (
		<img
			src="/icons/add-to-chat-dark-icon.svg"
			width={size}
			height={size}
			alt={Content["addToChatIcon.add.imgAlt"]}
		/>
	);
}
