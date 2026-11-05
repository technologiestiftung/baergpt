import {
	type MouseEvent,
	type ReactNode,
	type SyntheticEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

interface BottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	ariaLabelledBy?: string;
	children: ReactNode;
}

const prefersReducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CLOSE_FALLBACK_MS = 300;

export function BottomSheet({
	isOpen,
	onClose,
	ariaLabelledBy,
	children,
}: BottomSheetProps) {
	const dialogRef = useRef<HTMLDialogElement | null>(null);
	const [isClosing, setIsClosing] = useState(false);

	const finishClose = () => {
		setIsClosing(false);
		if (dialogRef.current?.open) {
			dialogRef.current.close();
		}
	};

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) {
			return;
		}

		if (isOpen && !dialog.open) {
			setIsClosing(false);
			dialog.showModal();
		}
		if (!isOpen && dialog.open) {
			if (prefersReducedMotion()) {
				dialog.close();
			} else {
				setIsClosing(true);
			}
		}
	}, [isOpen]);

	useEffect(() => {
		if (!isClosing) {
			return undefined;
		}
		const fallbackTimer = setTimeout(finishClose, CLOSE_FALLBACK_MS);
		return () => clearTimeout(fallbackTimer);
	}, [isClosing]);

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}
		// Prevent the page behind the sheet from scrolling, without undoing a
		// scroll lock another component already holds
		const wasLocked = document.body.classList.contains("overflow-hidden");
		document.body.classList.add("overflow-hidden");
		return () => {
			if (!wasLocked) {
				document.body.classList.remove("overflow-hidden");
			}
		};
	}, [isOpen]);

	const handleAnimationEnd = (event: SyntheticEvent<HTMLDialogElement>) => {
		if (event.target === dialogRef.current && isClosing) {
			finishClose();
		}
	};

	const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
		event.preventDefault();
		onClose();
	};

	const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
		if (event.target === dialogRef.current) {
			onClose();
		}
	};

	return createPortal(
		<dialog
			ref={dialogRef}
			aria-labelledby={ariaLabelledBy}
			onClose={onClose}
			onCancel={handleCancel}
			onClick={handleClick}
			onAnimationEnd={handleAnimationEnd}
			className={`fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-full max-h-[85vh] p-0 pb-[env(safe-area-inset-bottom)] overflow-y-auto bg-white rounded-t-[28px] text-dunkelblau-100 backdrop:bg-dunkelblau-100/20 backdrop:backdrop-blur-[2px] motion-reduce:animate-none motion-reduce:backdrop:animate-none
				${
					isClosing
						? "animate-slide-out-bottom backdrop:animate-fade-out-backdrop"
						: "animate-slide-in-bottom backdrop:animate-fade-in"
				}`}
		>
			<div className="flex justify-center p-4" aria-hidden="true">
				<div className="w-8 h-1 rounded-full bg-dunkelblau-60" />
			</div>
			{children}
		</dialog>,
		document.body,
	);
}
