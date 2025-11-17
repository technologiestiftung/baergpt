import React from "react";
import Content from "../../../content";

type ChevronIconProps = {
	color: "dunkelblau-200" | "dunkelblau-100" | "dunkelblau-80";
	direction?: "up" | "down";
	classname?: string;
};

export const ChevronIcon: React.FC<ChevronIconProps> = ({
	color,
	direction,
	classname,
}) => {
	return (
		<>
			<img
				src="/icons/chevron-up-dark-icon.svg"
				alt={Content["chevronIcon.up.imgAlt"]}
				width={20}
				height={20}
				className={`${color === "dunkelblau-200" && direction === "up" ? `block p-1 ${classname}` : "hidden"}`}
			/>
			<img
				src="/icons/chevron-up-icon.svg"
				alt={Content["chevronIcon.up.imgAlt"]}
				width={20}
				height={20}
				className={`${color === "dunkelblau-100" && direction === "up" ? `block p-1 ${classname}` : "hidden"}`}
			/>
			<img
				src="/icons/chevron-up-dark-blue-icon.svg"
				alt={Content["chevronIcon.up.imgAlt"]}
				width={20}
				height={20}
				className={`${color === "dunkelblau-80" && direction === "up" ? `block p-1 ${classname}` : "hidden"}`}
			/>

			<img
				src="/icons/chevron-down-dark-icon.svg"
				alt={Content["chevronIcon.down.imgAlt"]}
				width={20}
				height={20}
				className={`${color === "dunkelblau-200" && direction === "down" ? `block p-1 ${classname}` : "hidden"}`}
			/>
			<img
				src="/icons/chevron-down-icon.svg"
				alt={Content["chevronIcon.down.imgAlt"]}
				width={20}
				height={20}
				className={`${color === "dunkelblau-100" && direction === "down" ? `block p-1 ${classname}` : "hidden"}`}
			/>
			<img
				src="/icons/chevron-down-dark-blue-icon.svg"
				alt={Content["chevronIcon.down.imgAlt"]}
				width={20}
				height={20}
				className={`${color === "dunkelblau-80" && direction === "down" ? `block p-1 ${classname}` : "hidden"}`}
			/>
		</>
	);
};
