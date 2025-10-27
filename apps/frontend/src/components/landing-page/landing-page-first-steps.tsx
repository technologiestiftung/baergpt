import Content from "../../content.ts";

export function LandingPageFirstSteps() {
	return (
		<div className="flex flex-col py-[60px] sm:py-20 px-5 lg:px-0 text-dunkelblau-100 gap-2 sm:gap-5 lg:gap-12 lg:max-w-[934px] mx-auto">
			<h2 className="max-w-[624px] mx-auto text-center text-2xl leading-8 font-semibold sm:text-4xl sm:leading-10">
				{Content["landingPage.firstSteps.h2"]}
			</h2>
			<iframe
				className="w-full aspect-video rounded-[3px]"
				title={`Video: ${Content["landingPage.firstSteps.h2"]}`}
				src="https://player.vimeo.com/video/1082110109?&color=1E3791&title=0&byline=0&portrait=0&texttrack=de"
				allowFullScreen={true}
				referrerPolicy="strict-origin-when-cross-origin"
			/>
		</div>
	);
}
