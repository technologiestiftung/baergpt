import { create } from "zustand";

type ConsentType = "all" | "third-party-only" | "necessary-only";

interface ConsentOptions {
	type: ConsentType;
	thirdPartyCookies?: boolean;
}

interface CookieBannerState {
	isOpen: boolean;
	isExpanded: boolean;
	hasConsent: boolean | null;
	consentType: ConsentType | null;
	thirdPartyCookiesEnabled: boolean;
	openBanner: (expanded?: boolean) => void;
	setIsExpanded: (expanded: boolean) => void;
	setThirdPartyCookiesEnabled: (enabled: boolean) => void;
	checkConsent: () => void;
	acceptConsent: (options?: ConsentOptions) => void;
	declineConsent: () => void;
}

export const useCookieBannerStore = create<CookieBannerState>((set, get) => ({
	isOpen: false,
	isExpanded: false,
	hasConsent: null,
	consentType: null,
	thirdPartyCookiesEnabled: false,

	openBanner: (expanded = false) => set({ isOpen: true, isExpanded: expanded }),
	setIsExpanded: (expanded) => set({ isExpanded: expanded }),
	setThirdPartyCookiesEnabled: (enabled) =>
		set({ thirdPartyCookiesEnabled: enabled }),

	checkConsent: () => {
		const consent = localStorage.getItem("vimeo-cookies-consent");
		const consentType = localStorage.getItem(
			"vimeo-cookies-consent-type",
		) as ConsentType | null;

		const hasConsent = consent === "accepted";

		// Determine third party cookies based on consent type
		let thirdPartyCookiesEnabled = false;
		if (hasConsent && consentType) {
			thirdPartyCookiesEnabled =
				consentType === "all" || consentType === "third-party-only";
		}

		set({
			hasConsent,
			consentType,
			thirdPartyCookiesEnabled,
		});

		// Auto-open banner if no consent has been given
		if (!consent && !get().isOpen) {
			set({ isOpen: true });
		}
	},

	acceptConsent: (options) => {
		const consentType = options?.type || "all";
		const thirdPartyCookiesEnabled =
			options?.thirdPartyCookies ??
			(consentType === "all" || consentType === "third-party-only");

		localStorage.setItem("vimeo-cookies-consent", "accepted");
		localStorage.setItem("vimeo-cookies-consent-type", consentType);

		set({
			hasConsent: true,
			consentType,
			thirdPartyCookiesEnabled,
		});

		// Dispatch custom event with consent details
		window.dispatchEvent(
			new CustomEvent("cookies-accepted", {
				detail: {
					type: consentType,
					thirdPartyCookies: thirdPartyCookiesEnabled,
				},
			}),
		);

		set({ isOpen: false, isExpanded: false });
	},

	declineConsent: () => {
		localStorage.setItem("vimeo-cookies-consent", "declined");
		localStorage.setItem("vimeo-cookies-consent-type", "necessary-only");
		set({
			hasConsent: false,
			consentType: "necessary-only",
			thirdPartyCookiesEnabled: false,
			isOpen: false,
			isExpanded: false,
		});
	},
}));
