import React from "react";

interface DesktopProfileDropdownItemProps {
	type?: "link" | "button";
	icon: string;
	label: string;
	href?: string;
	onClick?: () => void;
	ariaLabel?: string;
}

export const DesktopProfileDropdownItem: React.FC<
	DesktopProfileDropdownItemProps
> = ({ type = "link", icon, label, href, onClick, ariaLabel }) => {
	const classes =
		"flex rounded-[3px] items-center px-1 py-0.5 gap-2 w-full bg-transparent text-sm leading-5 hover:bg-hellblau-60 focus-visible:bg-hellblau-60 focus-visible:outline-default cursor-pointer";

	if (type === "button") {
		return (
			<button className={classes} onClick={onClick} aria-label={ariaLabel}>
				<img src={icon} alt="" />
				<span>{label}</span>
			</button>
		);
	}

	return (
		<a href={href} className={classes}>
			<img src={icon} alt="" />
			<span>{label}</span>
		</a>
	);
};
