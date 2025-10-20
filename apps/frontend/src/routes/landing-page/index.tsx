import { LandingPageHero } from "../../components/landing-page/landing-page-hero.tsx";
import { LandingPageCards } from "../../components/landing-page/landing-page-cards.tsx";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";

export function LandingPage() {
	return (
		<LandingPageLayout>
			<LandingPageHero />
			<LandingPageCards />
		</LandingPageLayout>
	);
}
