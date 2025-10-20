import { LandingPageHero } from "../../components/landing-page/landing-page-hero.tsx";
import { LandingPageCards } from "../../components/landing-page/landing-page-cards.tsx";
import { LandingPageLayout } from "../../layouts/landing-page-layout.tsx";
import { LandingPageSafety } from "../../components/landing-page/landing-page-safety.tsx";

export function LandingPage() {
	return (
		<LandingPageLayout>
			<LandingPageHero />
			<div className="translate-y-[-80px] sm:translate-y-[-122px]">
				<LandingPageCards />
				<LandingPageSafety />
			</div>
		</LandingPageLayout>
	);
}
