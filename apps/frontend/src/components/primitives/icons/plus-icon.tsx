import Content from "../../../content";

export function PlusIcon({ enabled }: { enabled: boolean }) {
	return (
		<>
			<img
				src="icons/plus-enabled-icon.svg"
				alt={Content["plusIcon.imgAlt"]}
				width={24}
				height={24}
				className={enabled ? "block" : "hidden"}
			/>

			<img
				src="icons/plus-disabled-icon.svg"
				alt={Content["plusIcon.imgAlt"]}
				width={24}
				height={24}
				className={enabled ? "hidden" : "block"}
			/>
		</>
	);
}
