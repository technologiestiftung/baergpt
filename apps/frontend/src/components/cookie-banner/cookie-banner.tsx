import React, { useState, useEffect } from "react";
import { AccentButton } from "../primitives/buttons/accent-button";
import { Content } from "../../content.ts";
import { Switch } from "../primitives/switch/switch.tsx";

export const CookieBanner: React.FC = () => {
	const [showBanner, setShowBanner] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const [thirdPartyCookiesEnabled, setThirdPartyCookiesEnabled] =
		useState(false);

	useEffect(() => {
		const hasConsent = localStorage.getItem("vimeo-cookies-consent");
		if (!hasConsent) {
			setShowBanner(true);
		}
	}, []);

	const handleAcceptSelection = () => {
		if (thirdPartyCookiesEnabled) {
			localStorage.setItem("vimeo-cookies-consent", "accepted");
			// Enable Vimeo embeds
			window.dispatchEvent(new CustomEvent("cookies-accepted"));
		} else {
			localStorage.setItem("vimeo-cookies-consent", "declined");
		}
		setShowBanner(false);
	};

	const handleAcceptAll = () => {
		localStorage.setItem("vimeo-cookies-consent", "accepted");
		setShowBanner(false);
		// Enable Vimeo embeds
		window.dispatchEvent(new CustomEvent("cookies-accepted"));
	};

	const handleDecline = () => {
		localStorage.setItem("vimeo-cookies-consent", "declined");
		setShowBanner(false);
	};

	if (!showBanner) {
		return null;
	}

	return (
		<div className="fixed bottom-0 left-0 right-0 bg-hellblau-30 border-t border-hellblau-50 z-50">
			<div className="w-full max-w-screen-xl mx-auto gap-4 px-6 py-3 md:py-4 flex flex-col lg:flex-row items-center justify-between">
				{!isExpanded ? (
					<>
						<p className="max-w-3xl text-base leading-6 text-dunkelblau-100 self-start">
							{Content["cookiesBanner.message.short"]}
							<button
								onClick={() => setIsExpanded(true)}
								aria-label={Content["cookiesBanner.expandButton.ariaLabel"]}
								className="underline text-dunkelblau-100"
							>
								{Content["cookiesBanner.expandButton"]}
							</button>
						</p>
						<div className="flex flex-shrink-0 flex-col self-end w-full md:w-fit md:flex-row gap-2">
							<button
								onClick={handleDecline}
								className="px-4 py-1.5 text-dunkelblau-100 hover:underline"
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
					</>
				) : (
					<>
						<div className="flex flex-col gap-2">
							<div>
								<h2 className="text-lg text-dunkelblau-100 mb-2">
									{Content["cookiesBanner.title"]}
								</h2>
								<p className="w-full lg:max-w-3xl text-base leading-6 text-dunkelblau-100">
									{Content["cookiesBanner.message.long"]}
									<a
										href="/privacy-policy/"
										target="_blank"
										rel="noopener noreferrer"
										aria-label="Zum Hilfecenter von BärGPT"
										className="underline text-dunkelblau-100"
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
						<div className="flex flex-shrink-0 flex-col self-end w-full md:w-fit md:flex-row gap-2">
							{thirdPartyCookiesEnabled ? (
								<button
									onClick={handleAcceptSelection}
									className="text-dunkelblau-100 px-2.5 py-2
									rounded-3px border border-dunkelblau-100
									hover:bg-hellblau-60 
								focus-visible:outline-default"
									aria-label={Content["cookiesBanner.button.necessary"]}
								>
									{Content["cookiesBanner.button.acceptSelection"]}
								</button>
							) : (
								<button
									onClick={handleDecline}
									className="text-dunkelblau-100 px-2.5 py-2
								rounded-3px border border-dunkelblau-100
								hover:bg-hellblau-60 
								focus-visible:outline-default"
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
				)}
			</div>
		</div>
	);
};
