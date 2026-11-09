import { LandingPageHero } from "./landing-page-hero.tsx";
import { LandingPageCards } from "./landing-page-cards.tsx";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";
import { LandingPageSafety } from "./landing-page-safety.tsx";
import { LandingPageHelpCenterBanner } from "./landing-page-help-center-banner.tsx";
import { LandingPageFirstSteps } from "./landing-page-first-steps.tsx";
import { LandingPageRegisterCTA } from "./landing-page-register-cta.tsx";
import { useSessionRedirect } from "../../hooks/use-session-redirect.tsx";

export function LandingPage() {
	useSessionRedirect();

	return (
		<LandingPageLayout>
			<LandingPageHero />
			<LandingPageCards />
			<LandingPageSafety />
			<LandingPageHelpCenterBanner />
			<LandingPageFirstSteps />
			<LandingPageRegisterCTA />
		</LandingPageLayout>
	);
}
