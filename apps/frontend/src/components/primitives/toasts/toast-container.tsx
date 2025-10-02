import { useToastStore, type Toast } from "../../../store/use-toast-store";
import { SuccessToast } from "./success-toast";
import { ErrorToast } from "./error-toast";

const ToastItem = ({ toast }: { toast: Toast }) => {
	const removeToast = useToastStore((state) => state.removeToast);

	if (toast.type === "success") {
		return (
			<SuccessToast
				message={toast.message}
				isExiting={toast.isExiting}
				onClose={() => removeToast(toast.id)}
			/>
		);
	}

	if (toast.type === "error") {
		return (
			<ErrorToast error={toast.message} onClose={() => removeToast(toast.id)} />
		);
	}

	return null;
};

export const ToastContainer = () => {
	const { toasts } = useToastStore();

	if (toasts.length === 0) {
		return null;
	}

	return (
		<div className="fixed top-[70px] md:top-24 lg:top-28 right-5 z-50 pointer-events-none">
			<div className="flex flex-col gap-2">
				{toasts.map((toast) => (
					<ToastItem key={toast.id} toast={toast} />
				))}
			</div>
		</div>
	);
};
