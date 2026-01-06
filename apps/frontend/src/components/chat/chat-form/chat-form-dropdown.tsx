import React from "react";
import Content from "../../../content";

interface ChatFormDropdownProps {
	title: string;
	items: {
		label: string;
		value: string;
		description: string;
		ariaLabel: string;
	}[];
	selectedItems: string[];
	onItemClick: (value: string) => void;
	className?: string;
}

export const ChatFormDropdown: React.FC<ChatFormDropdownProps> = ({
	items,
	title,
	selectedItems,
	onItemClick,
	className,
}) => {
	return (
		<div
			className={`z-50 absolute bottom-full rounded-3px bg-white border border-hellblau-50 pt-3 focus-visible:outline-default shadow-md min-w-[280px] mb-1 ${className}`}
		>
			<div className="pb-3 px-4 border-b border-hellblau-50 text-dunkelblau-80 text-sm leading-6">
				{title}
			</div>
			<ul className="flex flex-col">
				{items.map((item) => {
					const isSelected = selectedItems.includes(item.value);
					return (
						<li key={item.value}>
							<button
								type="button"
								className="flex items-center justify-between w-full px-4 py-4 text-left gap-6 hover:bg-hellblau-30 focus-visible:outline-default rounded-3px"
								onClick={() => onItemClick(item.value)}
								aria-label={item.ariaLabel}
							>
								<div>
									<div
										className={`text-dunkelblau-80 text-sm leading-6 ${isSelected && "text-aktiv-blau-100"}`}
									>
										{item.label}
									</div>
									<div className="text-dunkelblau-50 text-xs leading-5">
										{item.description}
									</div>
								</div>

								<img
									src="/icons/check-active-icon.svg"
									alt={Content["chat.options.selected.icon.imgAlt"]}
									width={20}
									height={20}
									className={`${isSelected ? "block" : "hidden"}`}
								/>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
};
