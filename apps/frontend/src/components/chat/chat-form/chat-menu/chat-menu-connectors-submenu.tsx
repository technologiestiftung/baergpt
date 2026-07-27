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
		...(config.featureFlagMcpParlaAllowed
			? [
					{
						label: Content["mcp.options.dialog.option1.label"],
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
						value: CONNECTOR_VALUES.openData,
						ariaLabel: Content["mcp.options.dialog.option2.ariaLabel"],
						logo: "/icons/berlin-open-data-logo-icon.svg",
					},
				]
			: []),
		...(config.featureFlagMcpDatawrapperAllowed
			? [
					{
						label: Content["mcp.options.dialog.option3.label"],
						value: CONNECTOR_VALUES.datawrapper,
						ariaLabel: Content["mcp.options.dialog.option3.ariaLabel"],
						logo: "/icons/datawrapper-icon.svg",
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
	});

	return (
		<div
			className={`z-50 rounded-3px bg-white border border-hellblau-50 shadow-md min-w-[200px] ${className}`}
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
								className="flex items-center justify-between w-full px-1.5 py-0.5 text-left gap-6 hover:bg-hellblau-30 focus-visible:bg-hellblau-30 focus-visible:outline-default rounded-3px"
								onClick={() => handleSelect(item)}
								aria-label={item.ariaLabel}
								role="menuitemcheckbox"
								aria-checked={isSelected}
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
