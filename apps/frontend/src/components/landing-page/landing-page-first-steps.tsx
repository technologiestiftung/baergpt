import Content from "../../content.ts";
import { VimeoPlayer } from "../primitives/video-players/vimeo-player.tsx";

export function LandingPageFirstSteps() {
	return (
		<div className="flex flex-col py-[60px] sm:py-20 px-5 lg:px-0 text-dunkelblau-100 gap-2 sm:gap-5 lg:gap-12 lg:max-w-[934px] mx-auto">
			<h2 className="max-w-[624px] mx-auto text-center text-2xl leading-8 font-semibold sm:text-4xl sm:leading-10">
				{Content["landingPage.firstSteps.h2"]}
			</h2>
			<VimeoPlayer
				srcUrl="https://player.vimeo.com/video/1130927070?&color=1E3791&title=0&byline=0&portrait=0&texttrack=de"
				title={`Video: ${Content["landingPage.firstSteps.h2"]}`}
			/>
		</div>
	);
}
