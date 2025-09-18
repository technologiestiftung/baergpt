import React from "react";
import Content from "../../../content";

export const BucketIcon: React.FC<{
	disabled?: boolean;
	isLight?: boolean;
}> = ({ disabled = false, isLight = false }) => {
	return (
		<>
			<img
				src="/icons/bucket-enabled-icon.svg"
				alt={Content["bucketIcon.imgAlt"]}
				width={24}
				height={24}
				className={!disabled && !isLight ? "block" : "hidden"}
			/>

			<img
				src="/icons/bucket-disabled-icon.svg"
				alt={Content["bucketIcon.imgAlt"]}
				width={24}
				height={24}
				className={disabled ? "block" : "hidden"}
			/>

			<img
				src="/icons/bucket-light-icon.svg"
				alt={Content["bucketIcon.imgAlt"]}
				width={24}
				height={24}
				className={isLight && !disabled ? "block" : "hidden"}
			/>
		</>
	);
};
