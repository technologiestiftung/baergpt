import type React from "react";
import type { KeyboardEvent } from "react";
import Content from "../../../../content.ts";

interface ChatMenuRowProps {
	label: string;
	ariaLabel: string;
	icon: string | React.ReactNode;
	isSelected: boolean;
	isActive?: boolean;
	isCheckbox?: boolean;
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
	isCheckbox = false,
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
			className={`flex items-center justify-between w-full px-3 py-2 text-left gap-2 hover:bg-hellblau-60 focus-visible:bg-hellblau-60 focus-visible:outline-default rounded-3px ${isActive ? "bg-hellblau-60" : ""}`}
			onClick={onClick}
			onMouseEnter={onMouseEnter}
			onKeyDown={onKeyDown}
			aria-label={ariaLabel}
			role={isCheckbox ? "menuitemcheckbox" : "menuitem"}
			aria-checked={isCheckbox ? isSelected : undefined}
			aria-haspopup={hasSubmenu ? "menu" : undefined}
			aria-expanded={hasSubmenu ? isActive : undefined}
		>
			<div className="flex items-center gap-1 pr-[5px]">
				{typeof icon === "string" ? (
					<img src={icon} alt={label} width={20} height={20} />
				) : (
					<div
						className={`size-5 flex items-center justify-center ${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"}`}
					>
						{icon}
					</div>
				)}
				<div
					className={`text-sm leading-5 ${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"}`}
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
				src="/icons/chevron-right-icon.svg"
				alt=""
				width={20}
				height={20}
				className={`${hasSubmenu ? "block" : "hidden"}`}
				aria-hidden="true"
			/>
		</button>
	);
}
