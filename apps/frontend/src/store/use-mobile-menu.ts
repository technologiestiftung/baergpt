import { create } from "zustand";

interface MobileMenuStore {
	isMobileCheckboxVisible: boolean;
	toggleIsMobileCheckboxVisible: () => void;
}

export const useMobileMenuStore = create<MobileMenuStore>()((set, get) => ({
	isMobileCheckboxVisible: false,
	toggleIsMobileCheckboxVisible: () => {
		const { isMobileCheckboxVisible } = get();

		set({ isMobileCheckboxVisible: !isMobileCheckboxVisible });
	},
}));
