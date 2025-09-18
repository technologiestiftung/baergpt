import Content from "../../../content";

export function SidebarIcon({ isOpen }: { isOpen: boolean }) {
	return (
		<>
			<img
				src="icons/sidebar-close-icon.svg"
				alt={Content["barsIcon.imgAlt"]}
				width={22}
				height={22}
				className={isOpen ? "block" : "hidden"}
			/>

			<img
				src="icons/sidebar-open-icon.svg"
				alt={Content["barsIcon.imgAlt"]}
				width={22}
				height={22}
				className={isOpen ? "hidden" : "block"}
			/>
		</>
	);
}
