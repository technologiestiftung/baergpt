import Content from "../../content.ts";

export function LandingPageHero() {
	return (
		<div className="flex relative w-full bg-hellblau-100 text-dunkelblau-100 overflow-hidden z-10">
			<img
				className="absolute lg:top-[34px] sm:top-4 top-3 lg:right-16 sm:right-8 right-4 lg:w-[474px] sm:w-[380px] w-[220px]"
				src="/icons/baer-icon-large.svg"
				alt="baer-icon-large"
			/>
			<div className="lg:max-w-[934px] sm:max-w-[520px] max-w-[420px] mx-auto px-5 lg:pt-[150px] sm:pt-[80px] sm:pb-[200px] pt-[60px] pb-[140px] text-center flex flex-col items-center">
				<h1 className="z-10 lg:text-5xl lg:leading-none sm:font-semibold sm:mb-4 mb-2 sm:text-3xl sm:leading-9 text-xl leading-7 font-bold">
					{Content["landingPage.hero.h1"]}
				</h1>
				<h3 className="z-10 lg:text-2xl lg:leading-8 sm:text-lg sm:leading-7 font-semibold sm:mb-9 mb-4 text-sm leading-5">
					{Content["landingPage.hero.h3"]}
				</h3>

				{/* commented out until release */}
				{/* <a
					href={Content["landingPage.hero.register.link"]}
					aria-label={Content["landingPage.hero.register.ariaLabel"]}
					className={`
                                flex items-center h-11 text-white px-3 py-2
                                text-lg leading-7 font-normal z-10 
                                rounded-3px bg-dunkelblau-100 border border-dunkelblau-100
                                hover:bg-dunkelblau-90 focus-visible:outline-default 
                                `}
				>
					{Content["landingPage.hero.register.label"]}
				</a> */}
			</div>
		</div>
	);
}
