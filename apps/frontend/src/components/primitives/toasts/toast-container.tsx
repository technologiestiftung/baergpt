import {
	useToastStore,
	type Toast as ToastData,
} from "../../../store/use-toast-store";
import { Toast } from "./toast";

export const ToastContainer = () => {
	const { toasts, removeToast } = useToastStore();

	const renderToasts = (filter: (toast: ToastData) => boolean) =>
		toasts
			.filter(filter)
			.map((toast) => (
				<Toast
					key={toast.id}
					type={toast.type}
					message={toast.message}
					isExiting={toast.isExiting}
					onClose={() => removeToast(toast.id)}
				/>
			));

	return (
		<div className="fixed top-[70px] md:top-24 lg:top-28 right-5 z-50 pointer-events-none flex flex-col gap-2">
			<div role="alert" className="flex flex-col gap-2">
				{renderToasts((toast) => toast.type === "error")}
			</div>
			<div role="status" className="flex flex-col gap-2">
				{renderToasts((toast) => toast.type !== "error")}
			</div>
		</div>
	);
};
