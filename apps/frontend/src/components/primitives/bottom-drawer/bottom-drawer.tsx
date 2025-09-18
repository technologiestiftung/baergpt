import { ReactNode, useEffect, useState } from "react";
import { CloseIcon } from "../icons/close-icon.tsx";

interface BottomDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	style?: "dark" | "light";
	classNames?: string;
	isCompact?: boolean;
}

export function BottomDrawer({
	isOpen,
	onClose,
	title,
	children,
	classNames,
	style = "light",
	isCompact = false,
}: BottomDrawerProps) {
	const [isClosing, setIsClosing] = useState(false);
	// Prevent body scroll when the drawer is open
	useEffect(() => {
		document.body.classList.toggle("overflow-hidden");
		// Cleanup when component unmounts
		return () => document.body.classList.remove("overflow-hidden");
	}, [isOpen]);

	const handleClose = () => {
		setIsClosing(true);
		onClose();
		setTimeout(() => setIsClosing(false), 300);
	};

	return (
		<div
			className={`fixed md:hidden inset-0 z-30 transition-opacity duration-300 ${
				isOpen ? "opacity-100 overflow-y-auto" : "opacity-0 pointer-events-none"
			} ${classNames}`}
			onClick={handleClose}
		>
			<div
				className={`fixed left-0 w-full ${
					isCompact
						? "h-46 bottom-[84px]"
						: "h-[calc(100%-calc(50px+18px)-84px)] top-[calc(50px+18px)]"
				} flex flex-col rounded-t-2xl shadow-lg transition-transform duration-300 ease-in-out ${
					isOpen
						? "translate-y-0"
						: "translate-y-[calc(100%-calc(50px+18px)-84px})]"
				} ${isClosing ? "translate-y-full" : ""}
                ${style === "dark" ? "bg-dunkelblau-100" : "bg-hellblau-50"}`}
				onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
			>
				<div className="flex justify-between items-center px-5 pt-5">
					<h2
						className={`text-xl leading-7 font-bold ${style === "dark" ? "text-hellblau-50" : "text-dunkelblau-200"}`}
					>
						{title}
					</h2>
					<button
						onClick={handleClose}
						className="p-1 rounded-sm md:hover:bg-hellblau-60 focus-visible:outline-default"
					>
						{style === "dark" ? <CloseIcon variant="white" /> : <CloseIcon />}
					</button>
				</div>

				{children}
			</div>
		</div>
	);
}
