import React from "react";
import { Header } from "../headers/header.tsx";
import { useSessionRedirect } from "@/hooks/use-session-redirect.tsx";

interface LayoutProps {
	children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
	useSessionRedirect();

	return (
		<>
			<div className="flex font-arial text-dunkelblau-200 lining-nums proportional-nums">
				<div className="flex h-svh w-full flex-col overflow-hidden ">
					<Header />
					<main className="flex h-full overflow-y-auto">
						<div className="flex w-full flex-row">{children}</div>
					</main>
				</div>
			</div>
		</>
	);
};
