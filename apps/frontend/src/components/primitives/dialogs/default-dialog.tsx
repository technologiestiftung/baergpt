import React, { useEffect, useRef, useCallback } from "react";

interface DefaultDialogProps {
	children?: React.ReactNode;
	className?: string;
	id?: string;
	afterClose?: () => void;
	isOpen?: boolean;
}

export const DefaultDialog: React.FC<DefaultDialogProps> = ({
	children,
	className,
	id,
	afterClose,
}) => {
	const dialogRef = useRef<HTMLDialogElement | null>(null);

	const closeDialog = useCallback(() => {
		dialogRef.current?.close();
		afterClose?.();
	}, [afterClose]);

	const handleClickListener = useCallback((event: MouseEvent) => {
		if (!dialogRef.current) {
			return;
		}

		/**
		 * This is confusing, yet correct. The dialog element spreads over the whole screen.
		 * If the user clicks on something inside the dialog, the event target won't be the dialog itself.
		 */
		const isClickOnDialogBackground = event.target === dialogRef.current;

		if (!isClickOnDialogBackground) {
			return;
		}

		closeDialog();
	}, [closeDialog]);

	useEffect(() => {
		document.addEventListener("mousedown", handleClickListener);

		return () => {
			document.removeEventListener("mousedown", handleClickListener);
		};
	}, [handleClickListener]);

	return (
		<dialog
			ref={dialogRef}
			id={id}
			onClose={closeDialog}
			className={`${className} backdrop:bg-dunkelblau-100/30 backdrop:backdrop-blur-[2px] bg-white opacity-100 z-40 rounded-3px shadow-md`}
		>
			{children}
		</dialog>
	);
};
