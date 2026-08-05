import React, { useRef, useState, type KeyboardEvent } from "react";
import Content from "../../../../content.ts";
import { useDropdownKeyboard } from "../../../../hooks/use-dropdown-keyboard.ts";
import { ChatMenuConnectorsSubmenu } from "./chat-menu-connectors-submenu.tsx";
import { useChatsStore } from "../../../../store/use-chats-store.ts";
import { useFileUploadsStore } from "../../../../store/use-file-uploads-store.ts";
import { useErrorStore } from "../../../../store/error-store.ts";
import { WebSearchIcon } from "../../../primitives/icons/web-search-icon.tsx";
import type { ChatToolsMenuItemId } from "../../../../common.ts";
import { ChatMenuRow } from "./chat-menu-row.tsx";
import { config } from "../../../../config.ts";

export const CHAT_TOOLS_MENU_ID = "chat-tools-menu";

interface MenuItem {
	id: ChatToolsMenuItemId;
	label: string;
	ariaLabel: string;
	icon: string | React.ReactNode;
	isSelected: boolean;
	isCheckbox?: boolean;
	onSelect: () => void;
}

interface ChatMenuSectionProps {
	isOpen: boolean;
	onClose: () => void;
	className?: string;
}

export const ChatMenuSection: React.FC<ChatMenuSectionProps> = ({
	isOpen,
	onClose,
	className,
}) => {
	const { selectedChatTools, toggleChatTool } = useChatsStore();
	const { uploadFiles } = useFileUploadsStore();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const connectorsButtonRef = useRef<HTMLButtonElement | null>(null);
	const [isConnectorsSubmenuOpen, setIsConnectorsSubmenuOpen] = useState(false);

	const isMcpParlaAllowed = config.featureFlagMcpParlaAllowed;
	const isMcpOpenDataAllowed = config.featureFlagMcpOpenDataAllowed;
	const isMcpDatawrapperAllowed = config.featureFlagMcpDatawrapperAllowed;
	const isWebSearchAllowed = config.featureFlagWebSearchAllowed;

	const openConnectorsSubmenu = () => setIsConnectorsSubmenuOpen(true);
	const closeConnectorsSubmenu = () => setIsConnectorsSubmenuOpen(false);

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;

		if (files && files.length > 0) {
			uploadFiles(Array.from(files), { selectInChatOnSuccess: true }).catch(
				useErrorStore.getState().handleError,
			);
		}

		event.target.value = "";
		onClose();
	};

	const isWebSearchActive = selectedChatTools.includes("webSearch");

	const menuItems: MenuItem[] = [
		{
			id: "fileUpload",
			label: Content["chat.options.li1.label"],
			ariaLabel: Content["chat.options.li1.ariaLabel"],
			icon: "icons/upload-icon.svg",
			isSelected: false,
			onSelect: () => fileInputRef.current?.click(),
		},
		...(isMcpParlaAllowed || isMcpOpenDataAllowed || isMcpDatawrapperAllowed
			? [
					{
						id: "connectors",
						label: Content["chat.options.li2.label"],
						ariaLabel: Content["chat.options.li2.ariaLabel"],
						icon: "icons/connectors-icon.svg",
						isSelected: false,
						onSelect: openConnectorsSubmenu,
					} satisfies MenuItem,
				]
			: []),
		...(isWebSearchAllowed
			? [
					{
						id: "webSearch",
						label: Content["chat.options.li3.label"],
						ariaLabel: Content["chat.options.li3.ariaLabel"],
						icon: (
							<WebSearchIcon
								width={16}
								height={16}
								variant={isWebSearchActive ? "active" : "default"}
							/>
						),
						isSelected: isWebSearchActive,
						isCheckbox: true,
						onSelect: () => {
							toggleChatTool("webSearch");
							onClose();
						},
					} satisfies MenuItem,
				]
			: []),
	];

	const handleItemSelect = (id: ChatToolsMenuItemId) => {
		menuItems.find((item) => item.id === id)?.onSelect();
	};

	const { optionButtonRefs, handleKeyDown: handleDropdownKeyDown } =
		useDropdownKeyboard({
			items: menuItems.map((item) => item.id),
			isOpen,
			onClose,
			onItemClick: handleItemSelect,
		});

	const handleConnectorsKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === "ArrowRight") {
			event.preventDefault();
			openConnectorsSubmenu();
		}
	};

	// Focuses each option button when the dropdown is open
	const setOptionRef = (index: number) => (el: HTMLButtonElement | null) => {
		if (el) {
			optionButtonRefs.current.set(index, el);
		} else {
			optionButtonRefs.current.delete(index);
		}
	};

	return (
		<>
			<input
				type="file"
				ref={fileInputRef}
				onChange={handleFileSelect}
				accept={
					"application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
				}
				aria-label={Content["chat.options.li1.ariaLabel"]}
				className="hidden"
				multiple
			/>
			<div
				id={CHAT_TOOLS_MENU_ID}
				className={`z-50 absolute -left-0.5 bottom-full mb-3 rounded-3px bg-white border border-hellblau-50 focus-visible:outline-default shadow-md min-w-[200px] ${className}`}
				onKeyDown={handleDropdownKeyDown}
				role="menu"
				aria-label={Content["chat.options.toggleButton.tooltip.ariaLabel"]}
			>
				<ul role="none" className="flex flex-col">
					{menuItems.map((item, index) => {
						if (item.id === "connectors") {
							return (
								<li
									key={item.id}
									role="none"
									className="relative"
									onMouseEnter={openConnectorsSubmenu}
								>
									<ChatMenuRow
										label={item.label}
										ariaLabel={item.ariaLabel}
										icon={item.icon}
										isSelected={item.isSelected}
										isActive={isConnectorsSubmenuOpen}
										onClick={item.onSelect}
										onKeyDown={handleConnectorsKeyDown}
										optionButtonRef={(el) => {
											setOptionRef(index)(el);
											connectorsButtonRef.current = el;
										}}
										hasSubmenu={true}
									/>
									{isConnectorsSubmenuOpen && (
										<div className="absolute left-full bottom-[1px]">
											<ChatMenuConnectorsSubmenu
												isOpen={isConnectorsSubmenuOpen}
												onClose={closeConnectorsSubmenu}
												onItemSelect={onClose}
												connectorsButtonRef={connectorsButtonRef}
												className="ml-1"
											/>
										</div>
									)}
								</li>
							);
						}

						return (
							<li key={item.id} role="none">
								<ChatMenuRow
									label={item.label}
									ariaLabel={item.ariaLabel}
									icon={item.icon}
									isSelected={item.isSelected}
									isCheckbox={item.isCheckbox}
									onClick={item.onSelect}
									onMouseEnter={closeConnectorsSubmenu}
									optionButtonRef={setOptionRef(index)}
								/>
							</li>
						);
					})}
				</ul>
			</div>
		</>
	);
};
