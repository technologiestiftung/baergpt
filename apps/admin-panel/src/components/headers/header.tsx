import React from "react";
import Content from "../../content.ts";
import { DesktopProfileButton } from "@/profile/desktop-profile-button.tsx";

export const Header: React.FC = () => {
	return (
		<header className="h-[50px] md:h-[80px] flex items-center justify-between z-40 bg-white p-5 border-b border-black">
			<a href={"/"}>
				<img
					className="h-7 md:h-11"
					src="/logos/baergpt-logo.svg"
					alt={Content["header.logo.alt"]}
				/>
			</a>

			<nav className="hidden md:flex md:justify-end">
				<ul className="hidden md:flex gap-3">
					<li>
						<DesktopProfileButton />
					</li>
				</ul>
			</nav>
		</header>
	);
};
