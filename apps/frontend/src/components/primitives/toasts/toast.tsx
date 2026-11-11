import React from "react";
import { CloseIcon } from "../icons/close-icon.tsx";
import Content from "../../../content.ts";
import type { Toast as ToastData } from "../../../store/use-toast-store.ts";

const borderColorByType: Record<ToastData["type"], string> = {
	success: "border-mittelgruen",
	info: "border-dunkelblau-100",
	error: "border-warning-100",
};

interface ToastProps {
	type: ToastData["type"];
	message: string;
	onClose: () => void;
	isExiting?: boolean;
}

export const Toast: React.FC<ToastProps> = ({
	type,
	message,
	onClose,
	isExiting = false,
}) => {
	return (
		<div className="pointer-events-auto">
			<div
				className={`flex w-fit flex-row items-center rounded-3px pl-3 pr-2 py-2.5 bg-white border border-l-[6px] ${borderColorByType[type]} text-base leading-6 font-normal ${isExiting ? "animate-fade-out" : "animate-slide-in-right"}`}
				// Each toast mounts fresh, and only role="alert" is reliably announced on insertion
				role="alert"
			>
				{type === "success" && (
					<img
						src="/icons/green-check-icon.svg"
						width={24}
						height={24}
						alt={Content["greenCheckIcon.imgAlt"]}
						className="mr-2"
					/>
				)}
				<span className="flex-1 pr-3">{message}</span>
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
