import React from "react";
import { CloseIcon } from "../icons/close-icon.tsx";
import Content from "../../../content.ts";

interface SuccessToastProps {
	message: string;
	onClose: () => void;
	isExiting?: boolean;
}

export const SuccessToast: React.FC<SuccessToastProps> = ({
	message,
	onClose,
	isExiting = false,
}) => {
	return (
		<div className="pointer-events-auto">
			<div
				className={`flex w-fit flex-row items-center rounded-3px pl-3 pr-2 py-2.5 bg-white border border-l-[6px] border-mittelgruen text-base leading-6 font-normal ${isExiting ? "animate-fade-out" : "animate-slide-in-right"}`}
				role="alert"
				aria-live="polite"
			>
				<img
					src="/icons/green-check-icon.svg"
					width={24}
					height={24}
					alt={Content["greenCheckIcon.imgAlt"]}
				/>
				<span className="flex-1 pl-2 pr-3">{message}</span>
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
