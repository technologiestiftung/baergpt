import React from "react";
import Content from "../../../content.ts";
import { DesktopProfileButton } from "../../profile/profile-buttons/desktop-profile-button.tsx";
import { MobileProfileButton } from "../../profile/profile-buttons/mobile-profile-button.tsx";
import { ArrowTopRight } from "../../primitives/icons/arrow-top-right.tsx";

export const AppNavItems: React.FC = () => {
	return (
		<>
			{/* Desktop View */}
			<ul className="hidden md:flex gap-3 items-center">
				<li>
					<a
						href={Content["header.navigation.help.link"]}
						className={`
									hidden md:flex md:items-center h-9 gap-x-2 text-dunkelblau-100 pl-3 pr-1.5 py-2
									rounded-3px border border-dunkelblau-100
									hover:bg-hellblau-60
									focus-visible:outline-default 
									text-base leading-6 font-normal
									`}
					>
						{Content["header.navigation.help.label"]}
						<ArrowTopRight />
					</a>
				</li>

				<li>
					<DesktopProfileButton />
				</li>
			</ul>

			{/* Mobile View */}
			<a
				href={Content["header.navigation.help.link"]}
				className="flex md:hidden flex-col items-center justify-center gap-1 size-[52px] p-2 rounded-sm text-sm leading-5 font-normal text-hellblau-50 md:hover:bg-dunkelblau-80 focus-visible:outline-default"
				aria-label={Content["header.navigation.help.ariaLabel"]}
				target="_blank"
				rel="noopener noreferrer"
			>
				<img src="/icons/help-light-icon.svg" alt="" width={24} height={24} />
				{Content["header.navigation.help.mobileLabel"]}
			</a>
			<MobileProfileButton />
		</>
	);
};
