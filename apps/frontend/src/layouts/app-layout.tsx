import React from "react";
import { AppHeader } from "../components/headers/app/app-header.tsx";
import { Main } from "../components/main";
import { Tooltip } from "../components/primitives/tooltip/tooltip.tsx";
import { useSessionRedirect } from "../hooks/use-session-redirect.tsx";
import { ToastContainer } from "../components/primitives/toasts/toast-container.tsx";

interface AppLayoutProps {
	children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
	useSessionRedirect();

	return (
		<div className="flex font-arial text-dunkelblau-200 lining-nums proportional-nums">
			<div className="flex h-svh w-full flex-col overflow-hidden ">
				<AppHeader />
				<Main>{children}</Main>
			</div>
			<Tooltip />
			<ToastContainer />
		</div>
	);
};
