import React from "react";
import { useSessionRedirect } from "../hooks/use-session-redirect.tsx";
import { LandingPageHeader } from "../components/headers/landing-page/landing-page-header.tsx";
import { FooterLandingPage } from "../components/footer/footer-landing-page.tsx";
import { CookieBanner } from "../components/cookie-banner/cookie-banner.tsx";
interface AppLayoutProps {
	children: React.ReactNode;
}

export const LandingPageLayout: React.FC<AppLayoutProps> = ({ children }) => {
	useSessionRedirect();

	return (
		<div className="flex w-full flex-col font-arial text-dunkelblau-200 lining-nums proportional-nums">
			<LandingPageHeader />
			<main>{children}</main>
			<FooterLandingPage />
			<CookieBanner />
		</div>
	);
};
