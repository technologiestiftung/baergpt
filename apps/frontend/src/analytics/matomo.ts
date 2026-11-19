import { config } from "../config.ts";

type TrackingEvent = {
	eventCategory?: string;
	eventAction: string;
	eventName: string;
};

export function initMatomo() {
	window._paq = window._paq || [];
	window._paq.push(["trackPageView"]);
	window._paq.push(["enableLinkTracking"]);

	if (config.env === "test") {
		return;
	}

	window._paq.push(["setTrackerUrl", `${config.matomoUrl}matomo.php`]);
	window._paq.push(["setSiteId", config.matomoSiteId]);

	const script = document.createElement("script");
	script.async = true;
	script.src = `${config.matomoUrl}matomo.js`;
	document.head.appendChild(script);
}

// Todo: keep as is, will be needed for tracking
export function trackInteraction({
	eventCategory = "user-interaction",
	eventAction,
	eventName,
}: TrackingEvent) {
	/**
	 * Schema: ["trackEvent", "<event-category>", "<event-action>", "<event-name>", ]
	 */
	window._paq.push(["trackEvent", eventCategory, eventAction, eventName]);
}
