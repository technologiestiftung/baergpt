import React from "react";
import Content from "../../../content";

type FolderIconProps = {
	variant?: "default" | "darkblue";
	className?: string;
};

export const FolderIcon: React.FC<FolderIconProps> = ({
	variant = "default",
	className,
}) => (
	<>
		<img
			src="/icons/folder-icon.svg"
			width={20}
			height={20}
			className={`${className} ${variant === "default" ? "block" : "hidden"}`}
			alt={Content["folderIcon.imgAlt"]}
		/>

		<img
			src="/icons/folder-icon-darkblue.svg"
			width={20}
			height={20}
			className={`${className} ${variant === "darkblue" ? "block" : "hidden"}`}
			alt={Content["folderIcon.imgAlt"]}
		/>
	</>
);
