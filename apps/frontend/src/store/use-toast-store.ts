import { create } from "zustand";

export interface Toast {
	id: string;
	message: string;
	type: "success" | "error" | "info";
	duration?: number;
	isExiting?: boolean;
}

const DEFAULT_DURATION = 5000;
const EXIT_ANIMATION_DURATION = 300;

interface ToastStore {
	toasts: Toast[];
	addToast: (toast: Omit<Toast, "id">) => string;
	removeToast: (id: string) => void;
	addError: (message: string) => string;
	addSuccess: (message: string) => string;
}

export const useToastStore = create<ToastStore>((set, get) => ({
	toasts: [],
	addToast: (toast) => {
		const id = Date.now().toString();
		const newToast = {
			...toast,
			id,
			duration: toast.duration || DEFAULT_DURATION,
			isExiting: false,
		};
		set((state) => ({ toasts: [...state.toasts, newToast] }));

		setTimeout(() => {
			get().removeToast(id);
		}, newToast.duration);

		return id;
	},
	addError: (message: string) => {
		return get().addToast({ message, type: "error" });
	},
	addSuccess: (message: string) => {
		return get().addToast({ message, type: "success" });
	},
	removeToast: (id) => {
		const { toasts } = get();

		const existingToast = toasts.find((t) => t.id === id);

		if (!existingToast || existingToast.isExiting) {
			return;
		}

		const toastsDuringExiting = toasts.map((toast) =>
			toast.id === id ? { ...toast, isExiting: true } : toast,
		);
		set({ toasts: toastsDuringExiting });

		setTimeout(() => {
			const toastsAfterExit = get().toasts.filter((toast) => toast.id !== id);

			set({ toasts: toastsAfterExit });
		}, EXIT_ANIMATION_DURATION);
	},
}));
