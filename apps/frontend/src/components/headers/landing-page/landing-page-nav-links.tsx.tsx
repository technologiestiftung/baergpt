import React from "react";
import Content from "../../../content.ts";

export const LandingPageNavLinks: React.FC = () => {
	return (
		<>
			<ul className="flex gap-3">
				<li>
					<a
						href={Content["header.navigation.landingPage.login.link"]}
						aria-label={
							Content["header.navigation.landingPage.login.ariaLabel"]
						}
						className={`
									flex items-center h-9 text-dunkelblau-100 px-3 py-2
									rounded-3px border border-dunkelblau-100
									hover:bg-hellblau-60 focus-visible:outline-default 
									`}
					>
						{Content["header.navigation.landingPage.login.label"]}
					</a>
				</li>
				<li className="hidden sm:flex">
					<a
						href={Content["header.navigation.landingPage.register.link"]}
						aria-label={
							Content["header.navigation.landingPage.register.ariaLabel"]
						}
						className={`
									flex items-center h-9 text-white px-3 py-2
									rounded-3px bg-dunkelblau-100 border border-dunkelblau-100
									hover:bg-dunkelblau-90 focus-visible:outline-default 
									`}
					>
						{Content["header.navigation.landingPage.register.label"]}
					</a>
				</li>
			</ul>
		</>
	);
};
