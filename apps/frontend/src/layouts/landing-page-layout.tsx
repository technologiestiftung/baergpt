import React from "react";
import { Main } from "../components/main";
import { useSessionRedirect } from "../hooks/use-session-redirect.tsx";
import { LandingPageHeader } from "../components/headers/landing-page/landing-page-header.tsx";

interface AppLayoutProps {
	children: React.ReactNode;
}

export const LandingPageLayout: React.FC<AppLayoutProps> = ({ children }) => {
	useSessionRedirect();

	return (
		<div className="flex font-arial text-dunkelblau-200 lining-nums proportional-nums">
			<div className="flex h-svh w-full flex-col overflow-hidden ">
				<LandingPageHeader />
				<Main>{children}</Main>
			</div>
		</div>
	);
};
