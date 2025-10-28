import { LandingPageHero } from "../../components/landing-page/landing-page-hero.tsx";
import { LandingPageCards } from "../../components/landing-page/landing-page-cards.tsx";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";
import { LandingPageSafety } from "../../components/landing-page/landing-page-safety.tsx";
import { LandingPageHelpCenterBanner } from "../../components/landing-page/landing-page-help-center-banner.tsx";
import { LandingPageFirstSteps } from "../../components/landing-page/landing-page-first-steps.tsx";
import { LandingPageRegisterCTA } from "../../components/landing-page/landing-page-register-cta.tsx";

export function LandingPage() {
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
