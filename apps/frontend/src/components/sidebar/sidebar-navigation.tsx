import React from "react";
import { useDrawerStore } from "../../store/drawer-store";
import { Content } from "../../content";
import { SidebarLink } from "./sidebar-link.tsx";

const navItems = [
	{
		href: Content["sidebar.navigation.feedback.link"],
		iconSrc: "/icons/feedback-icon.svg",
		label: Content["sidebar.navigation.feedback"],
		ariaLabel: Content["sidebar.navigation.feedback.ariaLabel"],
	},
	{
		href: Content["sidebar.navigation.imprint.link"],
		iconSrc: "/icons/imprint-icon.svg",
		label: Content["sidebar.navigation.imprint"],
		ariaLabel: Content["sidebar.navigation.imprint.ariaLabel"],
	},
	{
		href: Content["sidebar.navigation.privacy.link"],
		iconSrc: "/icons/lock-icon.svg",
		label: Content["sidebar.navigation.privacy"],
		ariaLabel: Content["sidebar.navigation.privacy.ariaLabel"],
	},
];

export const SidebarNavigation: React.FC = () => {
	const { openDrawerId } = useDrawerStore();
	const isHistorySidebarOpen = openDrawerId === "history";

	return (
		<>
			<div className="w-full relative flex flex-col items-center md:gap-2">
				{navItems.map(({ href, iconSrc, label, ariaLabel }) => (
					<SidebarLink
						key={href}
						href={href}
						iconSrc={iconSrc}
						label={label}
						ariaLabel={ariaLabel}
						isLabelVisible={isHistorySidebarOpen}
					/>
				))}
			</div>
		</>
	);
};
