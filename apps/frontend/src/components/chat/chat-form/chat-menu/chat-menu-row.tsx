import type React from "react";
import type { KeyboardEvent } from "react";
import Content from "../../../../content.ts";

interface ChatMenuRowProps {
	label: string;
	ariaLabel: string;
	icon: string | React.ReactNode;
	isSelected: boolean;
	isActive?: boolean;
	onClick: () => void;
	onMouseEnter?: () => void;
	onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
	optionButtonRef: (el: HTMLButtonElement | null) => void;
	hasSubmenu?: boolean;
}

export function ChatMenuRow({
	label,
	ariaLabel,
	icon,
	isSelected,
	isActive = false,
	onClick,
	onMouseEnter,
	onKeyDown,
	optionButtonRef,
	hasSubmenu = false,
}: ChatMenuRowProps) {
	return (
		<button
			type="button"
			ref={optionButtonRef}
			className={`flex items-center justify-between w-full px-1.5 py-0.5 text-left gap-6 hover:bg-hellblau-30 focus-visible:bg-hellblau-30 focus-visible:outline-default rounded-3px ${isActive ? "bg-hellblau-30" : ""}`}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			onKeyDown={onKeyDown}
			aria-label={ariaLabel}
			role="option"
			aria-selected={isSelected}
			aria-haspopup={hasSubmenu ? "listbox" : undefined}
			aria-expanded={hasSubmenu ? isActive : undefined}
		>
			<div className="flex items-center">
				{typeof icon === "string" ? (
					<img
						src={icon}
						alt={label}
						width={20}
						height={20}
						className="m-1.5"
					/>
				) : (
					<div
						className={`m-1.5 size-5 flex items-center justify-center ${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"}`}
					>
						{icon}
					</div>
				)}
				<div
					className={`text-sm leading-6 ${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"}`}
				>
					{label}
				</div>
			</div>

			<img
				src="/icons/check-active-icon.svg"
				alt={Content["chat.options.selected.icon.imgAlt"]}
				width={20}
				height={20}
				className={`${isSelected ? "block" : "hidden"}`}
			/>
			<img
				src="/icons/chevron-small-right.svg"
				alt="Chevron right"
				width={16}
				height={16}
				className={`${hasSubmenu ? "block" : "hidden"}`}
			/>
		</button>
	);
}
