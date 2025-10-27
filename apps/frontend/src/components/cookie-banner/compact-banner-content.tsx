import React from "react";
import { AccentButton } from "../primitives/buttons/accent-button";
import { Content } from "../../content.ts";

type CompactBannerContentProps = {
	setExpanded: (expanded: boolean) => void;
	handleAcceptAll: () => void;
	handleDecline: () => void;
};

export const CompactBannerContent: React.FC<CompactBannerContentProps> = ({
	setExpanded,
	handleAcceptAll,
	handleDecline,
}) => {
	return (
		<div className="fixed bottom-0 left-0 right-0 bg-hellblau-30 border-t border-hellblau-50 z-50">
			<div className="w-full max-w-screen-xl mx-auto gap-4 px-6 py-3 md:py-4 flex flex-col lg:flex-row items-center justify-between">
				<div>
					<h2 className="text-lg text-dunkelblau-100 mb-2 font-semibold">
						{Content["cookiesBanner.title"]}
					</h2>
					<p className="max-w-3xl text-base leading-6 text-dunkelblau-100 self-start">
						{Content["cookiesBanner.message.short"]}
						<button
							onClick={() => setExpanded(true)}
							aria-label={Content["cookiesBanner.expandButton.ariaLabel"]}
							className="underline text-dunkelblau-100 outline-offset-1 focus-visible:outline-default rounded-3px"
						>
							{Content["cookiesBanner.expandButton"]}
						</button>
					</p>
				</div>

				<div className="flex flex-shrink-0 flex-col w-full md:w-fit md:flex-row gap-2">
					<button
						onClick={handleDecline}
						className="px-4 py-1.5 text-dunkelblau-100 hover:underline outline-offset-1 focus-visible:outline-default rounded-3px"
						aria-label={Content["cookiesBanner.button.deny"]}
					>
						{Content["cookiesBanner.button.deny"]}
					</button>

					<AccentButton
						onClick={handleAcceptAll}
						ariaLabel={Content["cookiesBanner.button.accept"]}
					>
						{Content["cookiesBanner.button.accept"]}
					</AccentButton>
				</div>
			</div>
		</div>
	);
};
