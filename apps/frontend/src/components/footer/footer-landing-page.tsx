import Content from "../../content.ts";
import { FooterLogoBanner } from "./footer-logo-banner.tsx";
import { useCookieBannerStore } from "../../store/use-cookie-banner-store.ts";

const topLinks = {
	section1: [
		{
			href: Content["footer.support.link"],
			text: Content["footer.support"],
		},
		{
			href: Content["footer.github.link"],
			text: Content["footer.github"],
		},
		{
			href: Content["footer.helpcenter.link"],
			text: Content["footer.helpcenter"],
		},
		{
			href: Content["footer.feedback.link"],
			text: Content["footer.feedback"],
		},
	],
	section2: [
		{
			href: Content["footer.imprint.link"],
			text: Content["footer.imprint"],
		},
		{
			href: Content["footer.privacy.link"],
			text: Content["footer.privacy"],
		},
		{
			href: Content["footer.terms.link"],
			text: Content["footer.terms"],
		},
	],
};

export function FooterLandingPage() {
	const { openBanner } = useCookieBannerStore();

	return (
		<footer className="flex flex-col">
			<div className="flex flex-col lg:flex-row gap-8 justify-between lg:items-center w-full p-6 md:py-8 lg:px-[50px] bg-dunkelblau-100 text-white">
				<img
					src="/logos/baergpt-logo-white.svg"
					alt={Content["footer.baerLogo.alt"]}
					width={186}
					height={44}
					className="self-start"
				/>
				<div className="flex justify-between md:justify-normal md:gap-[60px] lg:gap-14">
					<ul className="flex flex-col gap-3 w-fit">
						{topLinks.section1.map((link, index) => (
							<li key={index}>
								<a
									href={link.href}
									className="text-white text-base leading-6 font-normal w-fit rounded-3px focus-visible:outline-default hover:underline"
								>
									{link.text}
								</a>
							</li>
						))}
					</ul>
					<ul className="flex flex-col gap-3 w-fit">
						{topLinks.section2.map((link, index) => (
							<li key={index}>
								<a
									href={link.href}
									className="text-white text-base leading-6 font-normal w-fit rounded-3px focus-visible:outline-default hover:underline"
								>
									{link.text}
								</a>
							</li>
						))}
						<li>
							<button
								onClick={() => openBanner(true)}
								aria-label={Content["footer.cookieSettings.ariaLabel"]}
								className="text-white text-base leading-6 font-normal w-fit rounded-3px focus-visible:outline-default hover:underline"
							>
								{Content["footer.cookieSettings"]}
							</button>
						</li>
					</ul>
				</div>
			</div>
			<FooterLogoBanner />
		</footer>
	);
}
