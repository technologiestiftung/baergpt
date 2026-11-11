import { useToastStore } from "../../../store/use-toast-store";
import { Toast } from "./toast";

export const ToastContainer = () => {
	const { toasts, removeToast } = useToastStore();

	if (toasts.length === 0) {
		return null;
	}

	return (
		<div className="fixed top-[70px] md:top-24 lg:top-28 right-5 z-50 pointer-events-none">
			<div className="flex flex-col gap-2">
				{toasts.map((toast) => (
					<Toast
						key={toast.id}
						type={toast.type}
						message={toast.message}
						isExiting={toast.isExiting}
						onClose={() => removeToast(toast.id)}
					/>
				))}
			</div>
		</div>
	);
};
