import Content from "../../content.ts";

export function LandingPageRegisterCTA() {
	return (
		<div
			className={`flex flex-col items-center justify-center gap-3 p-5 py-[60px] sm:py-20 bg-hellblau-100 `}
		>
			<div className={`flex items-center gap-8 flex-col z-10`}>
				<div
					className={`flex flex-col justify-center gap-3 text-dunkelblau-200 items-center text-center`}
				>
					<h2 className="text-center text-2xl leading-8 font-semibold lg:text-4xl lg:leading-10">
						{Content["landingPage.registerCTA.h2"]}
					</h2>
					<p className="text-base leading-6 sm:text-lg sm:leading-7 lg:text-2xl lg:leading-8 font-normal">
						{Content["landingPage.registerCTA.p"]}
					</p>
				</div>
				<a
					href={Content["landingPage.registerCTA.link"]}
					aria-label={Content["landingPage.registerCTA.ariaLabel"]}
					className={`
                                                flex items-center h-11 text-white px-3 py-2
                                                text-lg leading-7 font-normal z-10 
                                                rounded-3px bg-dunkelblau-100 border border-dunkelblau-100
                                                hover:bg-dunkelblau-90 focus-visible:outline-default 
                                                `}
				>
					{Content["landingPage.registerCTA.label"]}
				</a>
			</div>
		</div>
	);
}
