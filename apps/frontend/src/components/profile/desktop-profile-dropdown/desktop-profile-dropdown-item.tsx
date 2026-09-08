import React from "react";

interface DesktopProfileDropdownItemProps {
	type?: "link" | "button";
	icon: string;
	label: string;
	href?: string;
	openInNewTab?: boolean;
	onClick?: () => void;
	ariaLabel?: string;
}

export const DesktopProfileDropdownItem: React.FC<
	DesktopProfileDropdownItemProps
> = ({
	type = "link",
	icon,
	label,
	href,
	openInNewTab,
	onClick,
	ariaLabel,
}) => {
	const classes =
		"flex rounded-[3px] items-center justify-center pl-1.5 pr-3 py-1 w-full bg-transparent text-sm leading-5 hover:bg-hellblau-60 focus-visible:bg-hellblau-60 focus-visible:outline-default cursor-pointer";

	if (type === "button") {
		return (
			<button className={classes} onClick={onClick} aria-label={ariaLabel}>
				<div className="p-1">
					<img src={icon} alt="" className="size-5" />
				</div>
				<span>{label}</span>
			</button>
		);
	}

	return (
		<a
			href={href}
			className={classes}
			aria-label={ariaLabel}
			target={openInNewTab ? "_blank" : undefined}
			rel={openInNewTab ? "noopener noreferrer" : undefined}
		>
			<div className="p-1">
				<img src={icon} alt="" className="size-5" />
			</div>
			<span>{label}</span>
		</a>
	);
};
