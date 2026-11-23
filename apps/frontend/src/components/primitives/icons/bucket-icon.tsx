import React from "react";
import Content from "../../../content";

const iconSrc = {
	red: "/icons/bucket-outline-dark-red-icon.svg",
	darkBlue: "/icons/bucket-dark-blue-icon.svg",
};

export const BucketIcon: React.FC<{
	color?: keyof typeof iconSrc;
	className?: string;
}> = ({ color = "red", className = "" }) => (
	<img
		src={iconSrc[color]}
		alt={Content["bucketIcon.imgAlt"]}
		width={16}
		height={16}
		className={className}
	/>
);
