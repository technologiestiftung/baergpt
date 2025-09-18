import Content from "../../../content";

export function BarsIcon({ isLight }: { isLight: boolean }) {
	return (
		<>
			<img
				src="icons/bars-light-icon.svg"
				alt={Content["barsIcon.imgAlt"]}
				width={22}
				height={22}
				className={isLight ? "block py-1 px-0.5" : "hidden"}
			/>

			<img
				src="icons/bars-dark-icon.svg"
				alt={Content["barsIcon.imgAlt"]}
				width={22}
				height={22}
				className={isLight ? "hidden" : "py-1 px-0.5 block"}
			/>
		</>
	);
}
