import React from "react";
import Content from "../../../content";

interface ChatFormDropdownProps {
	title: string;
	items: {
		label: string;
		description: string;
		ariaLabel: string;
	}[];
	selectedItems: string[];
	onItemClick: (label: string) => void;
}

export const ChatFormDropdown: React.FC<ChatFormDropdownProps> = ({
	items,
	title,
	selectedItems,
	onItemClick,
}) => {
	return (
		<div className="z-50 absolute bottom-full rounded-3px bg-white border border-hellblau-60 pt-4 focus-visible:outline-default shadow-md min-w-[280px] mb-1">
			<div className="pb-4 px-4 border-b border-hellblau-60 text-dunkelblau-80 text-sm leading-6">
				{title}
			</div>
			<ul className="flex flex-col">
				{items.map((item) => {
					const isSelected = selectedItems.includes(item.label);
					return (
						<li key={item.label}>
							<button
								className="flex items-center justify-between w-full px-4 py-4 text-left gap-6 hover:bg-hellblau-30 focus-visible:outline-default^ rounded-3px"
								onClick={() => onItemClick(item.label)}
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
