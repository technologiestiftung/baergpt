import React from "react";
import Content from "../../../content";
import { AuthNavLinks } from "./auth-nav-links.tsx";

export const AuthHeader: React.FC = () => {
	return (
		<header className="h-[80px] flex items-center justify-between z-40 bg-white p-5 lg:px-[50px] border-b border-black">
			<a href={"/"}>
				<img
					className="h-10"
					src="/logos/baergpt-logo.svg"
					alt={Content["header.logo.alt"]}
				/>
			</a>
			<nav>
				<AuthNavLinks />
			</nav>
		</header>
	);
};
