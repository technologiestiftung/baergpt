import React from "react";
import Content from "../../../content";
import { LandingPageNavLinks } from "./landing-page-nav-links.tsx";

export const LandingPageHeader: React.FC = () => {
	return (
		<header className="h-[80px] fixed top-0 left-0 right-0 z-40 bg-white p-5 lg:px-[50px] border-b border-black">
			<div className="flex items-center justify-between">
				<a href={"/"} className="self-start">
					<img
						className="h-10"
						src="/logos/baergpt-logo.svg"
						alt={Content["header.logo.alt"]}
					/>
				</a>

				<nav>
					<LandingPageNavLinks />
				</nav>
			</div>
		</header>
	);
};
