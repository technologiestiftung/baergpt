import { Content } from "../../content";

const logoLinks = [
	{
		spanText: " ",
		src: "/logos/citylab-berlin-logo.svg",
		alt: Content["footer.citylabLogo.alt"],
		href: Content["footer.citylabLogo.link"],
		width: 174,
		height: 35,
	},
	{
		spanText: Content["footer.technologiestiftungLogo.p"],
		src: "/logos/technologiestiftung-berlin-logo.svg",
		alt: Content["footer.technologiestiftungLogo.alt"],
		href: Content["footer.technologiestiftungLogo.link"],
		width: 176,
		height: 53,
	},
	{
		spanText: Content["footer.senatskanzleiLogo.p"],
		src: "/logos/senatskanzlei-logo.svg",
		alt: Content["footer.senatskanzleiLogo.alt"],
		href: Content["footer.senatskanzleiLogo.link"],
		width: 230,
		height: 38,
	},
];

export function FooterLogoBanner() {
	return (
		<ul className="w-full flex flex-col justify-center items-center py-5 md:items-start md:flex-row md:py-6 gap-12 text-center md:text-start text-schwarz-80">
			{logoLinks.map((item, index) => (
				<li key={index} className="flex flex-col gap-y-5">
					<span className="text-sm md:h-5 text-schwarz-40 tracking-[-0.15px]">
						{item.spanText}
					</span>
					<a
						href={item.href}
						target="_blank"
						rel="noopener noreferrer"
						className="focus-outline-default"
					>
						<img
							src={item.src}
							alt={item.alt}
							width={item.width}
							height={item.height}
						/>
					</a>
				</li>
			))}
		</ul>
	);
}
