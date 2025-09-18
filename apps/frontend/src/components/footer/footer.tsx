import { useAuthStore } from "../../store/auth-store.ts";
import Content from "../../content.ts";

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
			<div>
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
			</div>
		</footer>
	);
}
