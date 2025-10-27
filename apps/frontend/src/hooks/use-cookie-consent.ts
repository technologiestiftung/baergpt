import { useState, useEffect } from "react";

export const useCookieConsent = () => {
	const [hasConsent, setHasConsent] = useState<boolean | null>(null);

	useEffect(() => {
		const checkConsent = () => {
			const consent = localStorage.getItem("vimeo-cookies-consent");
			setHasConsent(consent === "accepted");
		};

		checkConsent();

		// Listen for consent changes
		const handleConsentChange = () => checkConsent();
		window.addEventListener("cookies-accepted", handleConsentChange);

		return () => {
			window.removeEventListener("cookies-accepted", handleConsentChange);
		};
	}, []);

	return hasConsent;
};
