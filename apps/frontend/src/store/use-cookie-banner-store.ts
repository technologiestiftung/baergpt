import { create } from "zustand";

interface CookieBannerState {
	isOpen: boolean;
	isExpanded: boolean;
	hasConsent: boolean | null;
	openBanner: (expanded?: boolean) => void;
	setExpanded: (expanded: boolean) => void;
	checkConsent: () => void;
	acceptConsent: () => void;
	declineConsent: () => void;
}

export const useCookieBannerStore = create<CookieBannerState>((set, get) => ({
	isOpen: false,
	isExpanded: false,
	hasConsent: null,

	openBanner: (expanded = false) => set({ isOpen: true, isExpanded: expanded }),
	setExpanded: (expanded) => set({ isExpanded: expanded }),

	checkConsent: () => {
		const consent = localStorage.getItem("vimeo-cookies-consent");
		const hasConsent = consent === "accepted";
		set({ hasConsent });

		// Auto-open banner if no consent has been given
		if (!consent && !get().isOpen) {
			set({ isOpen: true });
		}
	},

	acceptConsent: () => {
		localStorage.setItem("vimeo-cookies-consent", "accepted");
		set({ hasConsent: true });
		window.dispatchEvent(new CustomEvent("cookies-accepted"));
		set({ isOpen: false, isExpanded: false });
	},

	declineConsent: () => {
		localStorage.setItem("vimeo-cookies-consent", "declined");
		set({ hasConsent: false, isOpen: false, isExpanded: false });
	},
}));
