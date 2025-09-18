import React from "react";
import Content from "../../../content";

type DocumentIconProps = {
	variant: "lightBlue" | "black" | "darkBlue" | "white";
	className?: string;
};

export const DocumentIcon: React.FC<DocumentIconProps> = ({
	variant,
	className,
}) => (
	<>
		<img
			src="/icons/document-icon-dark.svg"
			width={24}
			height={24}
			alt={Content["documentIcon.imgAlt"]}
			className={`${className} ${variant === "black" ? "block" : "hidden"}`}
		/>

		<img
			src="/icons/document-icon-light.svg"
			width={24}
			height={24}
			alt={Content["documentIcon.imgAlt"]}
			className={`${className} ${variant === "lightBlue" ? "block" : "hidden"}`}
		/>
		<img
			src="icons/document-icon-dark-blue.svg"
			alt={Content["documentsToggleButton.imgAlt"]}
			width={24}
			height={24}
			className={`${className} ${variant === "darkBlue" ? "block" : "hidden"}`}
		/>
		<img
			src="icons/document-icon-white.svg"
			alt={Content["documentsToggleButton.imgAlt"]}
			width={24}
			height={24}
			className={`${className} ${variant === "white" ? "block" : "hidden"}`}
		/>
	</>
);
