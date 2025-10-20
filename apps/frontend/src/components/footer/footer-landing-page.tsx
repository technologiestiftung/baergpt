import { useAuthStore } from "../../store/auth-store.ts";
import Content from "../../content.ts";

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

const bottomItems = [
	{
		spanText: " ",
		src: "/logos/citylab-berlin-logo.svg",
		alt: Content["footer.citylabLogo.alt"],
		width: 174,
		height: 35,
	},
	{
		spanText: "Ein Projekt der",
		src: "/logos/technologiestiftung-berlin-logo.svg",
		alt: Content["footer.technologiestiftungLogo.alt"],
		width: 176,
		height: 53,
	},
	{
		spanText: "Gefördert durch",
		src: "/logos/senatskanzlei-logo.svg",
		alt: Content["footer.senatskanzleiLogo.alt"],
		width: 230,
		height: 38,
	},
];

export function FooterLandingPage() {
	const { session } = useAuthStore();

	if (session) {
		return null;
	}

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
						{topLinks.section1.map(
							(link, index) => (
								console.log(link),
								(
									<li key={index}>
										<a
											href={link.href}
											className="text-white text-base leading-6 font-normal w-fit rounded-3px focus-visible:outline-default hover:underline"
										>
											{link.text}
										</a>
									</li>
								)
							),
						)}
					</ul>
					<ul className="flex flex-col lg:flex-row gap-[5px] lg:gap-8">
						{topLinks.section2.map(
							(link, index) => (
								console.log(link),
								(
									<li key={index}>
										<a
											href={link.href}
											className="text-white text-base leading-6 font-normal w-fit rounded-3px focus-visible:outline-default hover:underline"
										>
											{link.text}
										</a>
									</li>
								)
							),
						)}
					</ul>
				</div>
			</div>
			<ul className="w-full flex flex-col justify-center items-center py-5 md:items-start md:flex-row md:py-6 gap-12 text-center md:text-start text-schwarz-80">
				{bottomItems.map((item, index) => (
					<li key={index} className="flex flex-col gap-y-5">
						<span className="text-sm md:h-5 text-schwarz-40 tracking-[-0.15px]">
							{item.spanText}
						</span>
						<img
							src={item.src}
							alt={item.alt}
							width={item.width}
							height={item.height}
						/>
					</li>
				))}
			</ul>
		</footer>
	);
}
