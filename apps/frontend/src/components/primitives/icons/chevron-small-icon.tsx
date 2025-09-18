import React from "react";
import Content from "../../../content";

type ChevronSmallIconProps = {
	direction: "right";
};

export const ChevronSmallIcon: React.FC<ChevronSmallIconProps> = ({
	direction,
}) => {
	return (
		<>
			<img
				src="/icons/chevron-small-right.svg"
				alt={Content["chevronSmallIcon.right.imgAlt"]}
				width={16}
				height={16}
				className={`${direction === "right" ? "block" : "hidden"}`}
			/>
		</>
	);
};
