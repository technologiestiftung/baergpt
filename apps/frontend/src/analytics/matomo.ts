type TrackingEvent = {
	eventCategory?: string;
	eventAction: string;
	eventName: string;
};
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
