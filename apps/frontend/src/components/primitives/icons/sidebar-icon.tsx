import Content from "../../../content";

export function SidebarIcon({ isOpen }: { isOpen: boolean }) {
	return (
		<>
			<img
				src="icons/sidebar-close-icon.svg"
				alt={Content["barsIcon.imgAlt"]}
				width={24}
				height={24}
				className={isOpen ? "block" : "hidden"}
			/>

			<img
				src="icons/sidebar-open-icon.svg"
				alt={Content["barsIcon.imgAlt"]}
				width={24}
				height={24}
				className={isOpen ? "hidden" : "block"}
			/>
		</>
	);
}
