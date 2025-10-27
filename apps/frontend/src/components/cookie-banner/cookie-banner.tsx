import React, { useEffect } from "react";
import { useCookieBannerStore } from "../../store/use-cookie-banner-store.ts";
import { CompactBannerContent } from "./compact-banner-content.tsx";
import { ExpandedBannerContent } from "./expanded-banner-content.tsx";

export const CookieBanner: React.FC = () => {
	const {
		isOpen,
		isExpanded,
		thirdPartyCookiesEnabled,
		checkConsent,
		setExpanded,
		setThirdPartyCookiesEnabled,
		acceptConsent,
		declineConsent,
	} = useCookieBannerStore();

	useEffect(() => {
		checkConsent();
	}, [checkConsent]);

	const handleAcceptSelection = () => {
		if (thirdPartyCookiesEnabled) {
			acceptConsent({ type: "third-party-only", thirdPartyCookies: true });
		} else {
			acceptConsent({ type: "necessary-only", thirdPartyCookies: false });
		}
	};

	const handleAcceptAll = () => {
		acceptConsent({ type: "all" });
	};

	const handleDecline = () => {
		declineConsent();
	};

	if (!isOpen) {
		return null;
	}

	return (
		<div className="fixed bottom-0 left-0 right-0 bg-hellblau-30 border-t border-hellblau-50 z-50">
			<div className="w-full max-w-screen-xl mx-auto gap-4 px-6 py-3 md:py-4 flex flex-col lg:flex-row items-center justify-between">
				{!isExpanded ? (
					<CompactBannerContent
						setExpanded={setExpanded}
						handleAcceptAll={handleAcceptAll}
						handleDecline={handleDecline}
					/>
				) : (
					<ExpandedBannerContent
						thirdPartyCookiesEnabled={thirdPartyCookiesEnabled}
						setThirdPartyCookiesEnabled={setThirdPartyCookiesEnabled}
						handleAcceptSelection={handleAcceptSelection}
						handleAcceptAll={handleAcceptAll}
						handleDecline={handleDecline}
					/>
				)}
			</div>
		</div>
	);
};
