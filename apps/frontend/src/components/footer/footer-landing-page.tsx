import Content from "../../content.ts";
import { FooterLogoBanner } from "./footer-logo-banner.tsx";

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
	],
};

export function FooterLandingPage() {
	return (
		<footer className="flex flex-col">
			<div className="flex flex-col lg:flex-row gap-6 justify-between lg:items-center w-full p-6 lg:py-4 lg:px-[50px] bg-dunkelblau-100 text-white">
				<img
					src="/logos/berlin-baer-logo.svg"
					alt={Content["footer.baerLogo.alt"]}
					width={44}
					height={44}
				/>
				<div className="flex flex-row gap-8">
					<ul className="flex flex-col lg:flex-row gap-[5px] lg:gap-8">
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
					<ul className="flex flex-col lg:flex-row gap-[5px] lg:gap-8">
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
					</ul>
				</div>
			</div>
			<FooterLogoBanner />
		</footer>
	);
}
