import React, { type RefObject } from "react";
import Content from "../../../../content.ts";
import { useChatsStore } from "../../../../store/use-chats-store.ts";
import type { Connector } from "../../../../common.ts";
import { useDropdownKeyboard } from "../../../../hooks/use-dropdown-keyboard.ts";
import { config } from "../../../../config.ts";

export const CONNECTOR_VALUES: Record<string, Connector> = {
	parla: "parla",
	openData: "openData",
	datawrapper: "datawrapper",
};

interface ConnectorItem {
	label: string;
	description: string;
	value: Connector;
	ariaLabel: string;
	logo: string;
}

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

	const connectorItems: ConnectorItem[] = [
		...(config.featureFlagMcpDatawrapperAllowed
			? [
					{
						label: Content["mcp.options.dialog.option3.label"],
						description: Content["mcp.options.dialog.option3.description"],
						value: CONNECTOR_VALUES.datawrapper,
						ariaLabel: Content["mcp.options.dialog.option3.ariaLabel"],
						logo: "/icons/datawrapper-icon.svg",
					},
				]
			: []),
		...(config.featureFlagMcpParlaAllowed
			? [
					{
						label: Content["mcp.options.dialog.option1.label"],
						description: Content["mcp.options.dialog.option1.description"],
						value: CONNECTOR_VALUES.parla,
						ariaLabel: Content["mcp.options.dialog.option1.ariaLabel"],
						logo: "/icons/parla-logo-icon.svg",
					},
				]
			: []),
		...(config.featureFlagMcpOpenDataAllowed
			? [
					{
						label: Content["mcp.options.dialog.option2.label"],
						description: Content["mcp.options.dialog.option2.description"],
						value: CONNECTOR_VALUES.openData,
						ariaLabel: Content["mcp.options.dialog.option2.ariaLabel"],
						logo: "/icons/berlin-open-data-logo-icon.svg",
					},
				]
			: []),
	];

	const handleSelect = (item: ConnectorItem) => {
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
		navigateWithTab: true,
	});

	return (
		<div
			className={`z-50 p-1 rounded-3px bg-hellblau-30 shadow-md ${className}`}
			onKeyDown={handleKeyDown}
			role="menu"
			aria-label={Content["chat.options.li2.ariaLabel"]}
			data-testid="chat-menu-connectors-submenu"
		>
			<ul role="none" className="flex flex-col">
				{connectorItems.map((item, index) => {
					const isSelected = selectedChatTools.includes(item.value);

					return (
						<li key={item.value} role="none">
							<button
								type="button"
								ref={(el) => {
									if (el) {
										optionButtonRefs.current.set(index, el);
									} else {
										optionButtonRefs.current.delete(index);
									}
								}}
								className="flex items-center justify-between w-full px-3 py-1.5 text-left gap-2 hover:bg-hellblau-60 focus-visible:bg-hellblau-60 focus-visible:outline-default rounded-3px"
								onClick={() => handleSelect(item)}
								aria-label={item.ariaLabel}
								role="menuitemcheckbox"
								aria-checked={isSelected}
							>
								<div className="flex items-center gap-1 pr-[3px]">
									<div className="shrink-0 size-6 rounded-3px drop-shadow-[0px_0px_1.5px_rgba(36,61,100,0.3)] bg-white flex items-center justify-center p-[3px]">
										<img
											src={item.logo}
											alt=""
											className="max-w-full max-h-full object-contain"
										/>
									</div>
									<div className="flex flex-col items-start">
										<p className="text-sm leading-5 font-semibold text-dunkelblau-90">
											{item.label}
										</p>
										<p className="text-xs leading-4 font-normal text-dunkelblau-65 whitespace-nowrap">
											{item.description}
										</p>
									</div>
								</div>

								<img
									src="/icons/check-active-icon.svg"
									alt={Content["chat.options.selected.icon.imgAlt"]}
									width={24}
									height={24}
									className={`${isSelected ? "block shrink-0" : "hidden"}`}
								/>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
};
