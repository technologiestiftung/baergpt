import React from "react";
import { useSessionRedirect } from "../hooks/use-session-redirect.tsx";
import { LandingPageHeader } from "../components/headers/landing-page/landing-page-header.tsx";

interface AppLayoutProps {
	children: React.ReactNode;
}

export const LandingPageLayout: React.FC<AppLayoutProps> = ({ children }) => {
	useSessionRedirect();

	return (
		<div className="flex font-arial text-dunkelblau-200 lining-nums proportional-nums">
			<div className="flex w-full flex-col">
				<LandingPageHeader />
				<main>{children}</main>
			</div>
		</div>
	);
};
