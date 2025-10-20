import { LandingPageHero } from "../../components/landing-page/landing-page-hero.tsx";
import { LandingPageCards } from "../../components/landing-page/landing-page-cards.tsx";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";
import { LandingPageSafety } from "../../components/landing-page/landing-page-safety.tsx";
import { LandingPageHelpCenterBanner } from "../../components/landing-page/landing-page-help-center-banner.tsx";
import { LandingPageFirstSteps } from "../../components/landing-page/landing-page-first-steps.tsx";

export function LandingPage() {
	return (
		<LandingPageLayout>
			<LandingPageHero />
			<div className="translate-y-[-80px] sm:translate-y-[-122px]">
				<LandingPageCards />
				<LandingPageSafety />
				<LandingPageHelpCenterBanner />
				<LandingPageFirstSteps />
			</div>
		</LandingPageLayout>
	);
}
