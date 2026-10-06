import React from "react";
import { useDrawerStore } from "../../store/drawer-store";
import { Content } from "../../content";
import { SidebarLink } from "./sidebar-link.tsx";
import { SidebarButton } from "./sidebar-button.tsx";
import { openSplashModal } from "../splash-modal.tsx";

const newsNavItem = {
	iconSrc: "/icons/news-icon.svg",
	label: Content["sidebar.navigation.news"],
	ariaLabel: Content["sidebar.navigation.news.ariaLabel"],
};

const linkNavItems = [
	{
		href: Content["sidebar.navigation.help.link"],
		iconSrc: "/icons/help-light-icon.svg",
		label: Content["sidebar.navigation.help"],
		ariaLabel: Content["sidebar.navigation.help.ariaLabel"],
	},
	{
		href: Content["sidebar.navigation.feedback.link"],
		iconSrc: "/icons/feedback-icon.svg",
		label: Content["sidebar.navigation.feedback"],
		ariaLabel: Content["sidebar.navigation.feedback.ariaLabel"],
	},
];

export const SidebarNavigation: React.FC = () => {
	const { openDrawerId } = useDrawerStore();
	const isHistorySidebarOpen = openDrawerId === "history";

	return (
		<>
			<div className="w-full relative flex flex-col items-center md:gap-2">
				<SidebarButton
					iconSrc={newsNavItem.iconSrc}
					label={newsNavItem.label}
					ariaLabel={newsNavItem.ariaLabel}
					isLabelVisible={isHistorySidebarOpen}
					onClick={() => openSplashModal()}
				/>
				{linkNavItems.map(({ href, iconSrc, label, ariaLabel }) => (
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
