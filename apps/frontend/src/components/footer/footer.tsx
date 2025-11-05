import { useAuthStore } from "../../store/auth-store.ts";
import Content from "../../content.ts";
import { FooterLogoBanner } from "./footer-logo-banner.tsx";

const topLinks = [
	{
		href: Content["footer.imprint.link"],
		text: Content["footer.imprint"],
	},
	{
		href: Content["footer.imprint.link"],
		text: Content["footer.privacy"],
	},
];

export function Footer() {
	const { session } = useAuthStore();

	if (session) {
		return null;
	}

	return (
		<footer className="flex flex-col">
			<div className="flex flex-col md:flex-row gap-6 justify-between md:items-center w-full p-6 md:py-4 md:px-[50px] bg-dunkelblau-100 text-white">
				<img
					src="/logos/berlin-baer-logo.svg"
					alt={Content["footer.baerLogo.alt"]}
					width={44}
					height={44}
				/>
				<ul className="flex flex-col md:flex-row gap-2 md:gap-8">
					{topLinks.map((link, index) => (
						<li key={index}>
							<a
								href={link.href}
								className="text-white md:text-xl font-normal w-fit rounded-3px focus-visible:outline-default"
							>
								{link.text}
							</a>
						</li>
					))}
				</ul>
			</div>
			<FooterLogoBanner />
		</footer>
	);
}
