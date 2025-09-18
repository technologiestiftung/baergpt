import React from "react";
import Content from "../../../content";

export type CheckboxState = "checked" | "unchecked" | "indeterminate";

export const CheckboxIcon: React.FC<{ state: CheckboxState }> = ({ state }) => {
	const uncheckedHoverClass =
		state === "unchecked" || state === "indeterminate"
			? "hidden group-hover/checkbox:block"
			: "hidden";

	return (
		<>
			<img
				src="/icons/check-unchecked-icon.svg"
				alt={Content["checkboxIcon.unchecked.imgAlt"]}
				width={20}
				height={20}
				className={`${state === "unchecked" ? "block group-hover/checkbox:hidden" : "hidden"}`}
			/>

			<img
				src="/icons/check-unchecked-hover-icon.svg"
				alt={Content["checkboxIcon.unchecked.imgAlt"]}
				width={20}
				height={20}
				className={uncheckedHoverClass}
			/>

			<img
				src="/icons/check-checked-icon.svg"
				alt={Content["checkboxIcon.checked.imgAlt"]}
				width={20}
				height={20}
				className={`${state === "checked" ? "block" : "hidden"}`}
			/>

			<img
				src="/icons/check-indeterminate-icon.svg"
				alt={Content["checkboxIcon.indeterminate.imgAlt"]}
				width={20}
				height={20}
				className={`${state === "indeterminate" ? "block group-hover/checkbox:hidden" : "hidden"}`}
			/>
		</>
	);
};
