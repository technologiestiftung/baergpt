import Content from "../../content.ts";

const cards = [
	{
		title: Content["landingPage.cards.title1"],
		description: Content["landingPage.cards.description1"],
		imgLink: "/icons/speach-bubble-icon.svg",
		altText: Content["landingPage.cards.altText1"],
	},
	{
		title: Content["landingPage.cards.title2"],
		description: Content["landingPage.cards.description2"],
		imgLink: "/icons/document-search-icon.svg",
		altText: Content["landingPage.cards.altText2"],
	},
	{
		title: Content["landingPage.cards.title3"],
		description: Content["landingPage.cards.description3"],
		imgLink: "/icons/book-icon.svg",
		altText: Content["landingPage.cards.altText3"],
	},
	{
		title: Content["landingPage.cards.title4"],
		description: Content["landingPage.cards.description4"],
		imgLink: "/icons/asterisk-icon.svg",
		altText: Content["landingPage.cards.altText4"],
	},
];

export function LandingPageCards() {
	return (
		<div className="max-w-[934px] translate-y-[-80px] sm:translate-y-[-122px] mx-auto px-5 lg:px-0 gap-[18px] text-center flex flex-col items-center text-dunkelblau-100">
			{cards.map((card, index) => (
				<div
					key={index}
					className="flex flex-col sm:flex-row items-start sm:items-center text-start lg:px-10 lg:py-6 sm:px-9 px-6 py-5 bg-hellblau-30 sm:gap-10 gap-5 rounded-3px"
				>
					<img
						src={card.imgLink}
						alt={card.altText}
						className="lg:size-[100px] sm:size-[90px] size-[50px]"
					/>
					<div className="flex flex-col lg:gap-4 gap-2">
						<h3 className="lg:text-3xl lg:leading-9 font-semibold sm:text-2xl sm:leading-8 text-xl leading-7">
							{card.title}
						</h3>
						<p className="lg:text-lg lg:leading-7 font-normal text-wrap text-base leading-6">
							{card.description}
						</p>
					</div>
				</div>
			))}
		</div>
	);
}
