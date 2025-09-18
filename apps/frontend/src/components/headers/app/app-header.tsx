import React from "react";
import { AppNavItems } from "./app-nav-items.tsx";
import Content from "../../../content";
import { useAuthStore } from "../../../store/auth-store.ts";

export const AppHeader: React.FC = () => {
	const { session } = useAuthStore();

	return (
		<header className="h-[50px] md:h-[80px] flex items-center justify-between z-40 bg-white p-5 border-b border-black">
			<a href={"/"}>
				<img
					className="h-7 md:h-11"
					src="/logos/baergpt-logo.svg"
					alt={Content["header.logo.alt"]}
				/>
			</a>
			{session && (
				<nav className="hidden md:flex md:justify-end">
					<AppNavItems />
				</nav>
			)}
		</header>
	);
};
