import React from "react";
import { CloseIcon } from "../icons/close-icon.tsx";
import { YellowExclamationMarkIcon } from "../icons/yellow-exclamation-mark-icon.tsx";
import { Content } from "../../../content.ts";

interface ErrorToastProps {
	error: string;
	onClose: () => void;
}
export const ErrorToast: React.FC<ErrorToastProps> = ({ error, onClose }) => {
	return (
		<div className="pointer-events-auto">
			<div className="flex w-fit flex-row items-center gap-4 rounded-3px bg-hellblau-100 p-4 text-dunkelblau-200 shadow-md">
				<YellowExclamationMarkIcon />
				<span className="flex-1">{error}</span>
				<button
					className="flex-shrink-0"
					onClick={onClose}
					aria-label={Content["toast.close.ariaLabel"]}
				>
					<CloseIcon />
				</button>
			</div>
		</div>
	);
};
