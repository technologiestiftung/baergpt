import React, { type RefObject } from "react";
import Content from "../../../../content.ts";
import { useChatsStore } from "../../../../store/use-chats-store.ts";
import type { Connector } from "../../../../common.ts";
import { useDropdownKeyboard } from "../../../../hooks/use-dropdown-keyboard.ts";

export const CONNECTOR_VALUES: Record<string, Connector> = {
	parla: "parla",
};

const connectorItems = [
	{
		label: Content["mcp.options.dialog.option1.label"],
		value: CONNECTOR_VALUES.parla,
		ariaLabel: Content["mcp.options.dialog.option1.ariaLabel"],
		logo: "/icons/parla-logo-icon.svg",
	},
];

interface ChatMenuConnectorsSubmenuProps {
	isOpen: boolean;
	onClose: () => void;
	onItemSelect: () => void;
	connectorsButtonRef: RefObject<HTMLButtonElement | null>;
	className?: string;
}

export const ChatMenuConnectorsSubmenu: React.FC<
	ChatMenuConnectorsSubmenuProps
> = ({ isOpen, onClose, onItemSelect, connectorsButtonRef, className }) => {
	const { selectedChatTools, toggleChatTool } = useChatsStore();

	const handleSelect = (item: (typeof connectorItems)[number]) => {
		toggleChatTool(item.value);
		onItemSelect();
	};

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items: connectorItems,
		isOpen,
		onClose: () => {
			onClose();
			connectorsButtonRef.current?.focus();
		},
		onItemClick: handleSelect,
		closeOnArrowLeft: true,
	});

	return (
		<div
			className={`z-50 rounded-3px bg-white border border-hellblau-50 shadow-md min-w-[200px] ${className}`}
			onKeyDown={handleKeyDown}
			role="listbox"
			data-testid="chat-menu-connectors-submenu"
		>
			<ul className="flex flex-col">
				{connectorItems.map((item, index) => {
					const isSelected = selectedChatTools.includes(item.value);

					return (
						<li key={item.value}>
							<button
								type="button"
								ref={(el) => {
									if (el) {
										optionButtonRefs.current.set(index, el);
									} else {
										optionButtonRefs.current.delete(index);
									}
								}}
								className="flex items-center justify-between w-full px-1.5 py-0.5 text-left gap-6 hover:bg-hellblau-30 focus-visible:bg-hellblau-30 focus-visible:outline-default rounded-3px"
								onClick={() => handleSelect(item)}
								aria-label={item.ariaLabel}
								role="option"
								aria-selected={isSelected}
							>
								<div className="flex items-center">
									<img
										src={item.logo}
										alt=""
										width={20}
										height={20}
										className="m-1"
									/>
									<div
										className={`text-sm leading-6 ${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"}`}
									>
										{item.label}
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
