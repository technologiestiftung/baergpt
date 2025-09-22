import React from "react";
import Content from "../../../content";

type ChevronIconProps = {
	direction: "up" | "down";
};

export const ChevronLargeIcon: React.FC<ChevronIconProps> = ({ direction }) => {
	return (
		<>
			<img
				src="/icons/chevron-large-up-icon.svg"
				alt={Content["chevronIcon.up.imgAlt"]}
				width={16}
				height={16}
				className={`${direction === "up" ? "block" : "hidden"}`}
			/>

			<img
				src="/icons/chevron-large-down-icon.svg"
				alt={Content["chevronIcon.down.imgAlt"]}
				width={16}
				height={16}
				className={`${direction === "down" ? "block" : "hidden"}`}
			/>
		</>
	);
};
