import React from "react";
import { AccentButton } from "../primitives/buttons/accent-button";
import { Content } from "../../content.ts";
import { Switch } from "../primitives/switch/switch.tsx";

type ExpandedBannerContentProps = {
	thirdPartyCookiesEnabled: boolean;
	setThirdPartyCookiesEnabled: (enabled: boolean) => void;
	handleAcceptSelection: () => void;
	handleAcceptAll: () => void;
	handleDecline: () => void;
};

export const ExpandedBannerContent: React.FC<ExpandedBannerContentProps> = ({
	thirdPartyCookiesEnabled,
	setThirdPartyCookiesEnabled,
	handleAcceptSelection,
	handleAcceptAll,
	handleDecline,
}) => {
	return (
		<>
			<div className="flex flex-col gap-2">
				<div>
					<h2 className="text-lg text-dunkelblau-100 mb-2 font-semibold">
						{Content["cookiesBanner.title"]}
					</h2>
					<p className="w-full lg:max-w-3xl text-base leading-6 text-dunkelblau-100">
						{Content["cookiesBanner.message.long"]}
						<a
							href="/privacy-policy/"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="Zum Hilfecenter von BärGPT"
							className="underline text-dunkelblau-100 outline-offset-1 focus-visible:outline-default rounded-3px"
						>
							{Content["cookiesBanner.message.linkText"]}
						</a>
					</p>
				</div>
				<div className="flex gap-6 items-center">
					<label className="text-dunkelblau-100 font-semibold">
						{Content["cookiesBanner.thirdPartyCookies.label"]}
					</label>
					<Switch
						checked={thirdPartyCookiesEnabled}
						onChange={setThirdPartyCookiesEnabled}
					/>
				</div>
			</div>
			<div className="flex flex-shrink-0 flex-col md:self-end lg:self-center w-full md:w-fit md:flex-row gap-2">
				{thirdPartyCookiesEnabled ? (
					<button
						onClick={handleAcceptSelection}
						className="px-3 py-2 text-lg leading-7 font-normal h-11 text-dunkelblau-100
						rounded-3px border border-dunkelblau-100
						hover:bg-hellblau-60 focus-visible:outline-default"
						aria-label={Content["cookiesBanner.button.necessary"]}
					>
						{Content["cookiesBanner.button.acceptSelection"]}
					</button>
				) : (
					<button
						onClick={handleDecline}
						className="px-3 py-2 text-lg leading-7 font-normal h-11 text-dunkelblau-100
						rounded-3px border border-dunkelblau-100
						hover:bg-hellblau-60 focus-visible:outline-default"
						aria-label={Content["cookiesBanner.button.necessary"]}
					>
						{Content["cookiesBanner.button.necessary"]}
					</button>
				)}

				<AccentButton
					onClick={handleAcceptAll}
					ariaLabel={Content["cookiesBanner.button.accept"]}
				>
					{Content["cookiesBanner.button.acceptAll"]}
				</AccentButton>
			</div>
		</>
	);
};
