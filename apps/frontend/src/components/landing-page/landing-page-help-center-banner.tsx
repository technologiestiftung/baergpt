import { ArrowTopRight } from "../primitives/icons/arrow-top-right";
import Content from "../../content.ts";

export function LandingPageHelpCenterBanner() {
	return (
		<div className="flex flex-col justify-center sm:flex-row-reverse items-center bg-hellblau-30 py-[60px] sm:py-20 px-5 text-dunkelblau-100">
			<div className="sm:w-[316px] lg:w-[338px] shrink-0 flex justify-center items-center">
				<img
					src="/logos/baergpt-help-center-logo.svg"
					alt={Content["landingPage.helpCenterBanner.logo.altText"]}
					className="mb-10"
				/>
			</div>
			<div className="flex flex-col text-center sm:text-start items-center sm:items-start max-w-[624px] lg:max-w-[816px]">
				<h2 className="text-2xl leading-8 font-semibold sm:text-3xl sm:leading-9 lg:text-4xl lg:leading-10 mb-4">
					{Content["landingPage.helpCenterBanner.h2"]}
				</h2>
				<p className="text-base leading-6 sm:text-lg sm:leading-7 lg:text-2xl lg:leading-8 font-normal mb-5 sm:mb-9">
					{Content["landingPage.helpCenterBanner.p1"]}
				</p>
				<a
					href="https://hilfe.baergpt.berlin"
					className={`
                            flex items-center gap-x-2 text-lg text-dunkelblau-100 pl-3 pr-1.5 py-2
                            rounded-3px border border-dunkelblau-100
                            hover:bg-hellblau-60 h-11
                            focus-visible:outline-default 
                            `}
				>
					{Content["landingPage.helpCenterBanner.helpLink.label"]}
					<ArrowTopRight />
				</a>
			</div>
		</div>
	);
}
