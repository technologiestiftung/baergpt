import React, {
	useState,
	useRef,
	useCallback,
	type KeyboardEvent,
} from "react";
import { useClickOutside } from "../../../hooks/use-click-outside.ts";
import { useDropdownKeyboard } from "../../../hooks/use-dropdown-keyboard.ts";
import { useIsMobile } from "../../../hooks/use-mobile.tsx";
import { useTooltipStore } from "../../../store/tooltip-store.ts";
import Content from "../../../content.ts";
import { SettingsIcon } from "../../primitives/icons/settings-icon.tsx";
import { MenuRow } from "../../primitives/menu/menu-row.tsx";
import { HistoryGroupBySubmenu } from "./history-group-by-submenu.tsx";
import { showDeleteAllChatsDialog } from "./delete-history-entry/delete-history-entries-dialog.tsx";
import { BucketIcon } from "../../primitives/icons/bucket-icon.tsx";

type TopLevelMenuItemId = "groupBy" | "deleteAll";

const topLevelMenuItems: TopLevelMenuItemId[] = ["groupBy", "deleteAll"];

export function HistoryGroupByDropdown() {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isGroupBySubmenuOpen, setIsGroupBySubmenuOpen] = useState(false);
	const [dropdownPosition, setDropdownPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const selectButtonRef = useRef<HTMLButtonElement>(null);
	const groupByRowRef = useRef<HTMLButtonElement | null>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const { showTooltip, hideTooltip } = useTooltipStore();
	const isMobile = useIsMobile();

	const handleShowTooltip = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		if (isDropdownOpen) {
			return;
		}

		showTooltip({
			event,
			content: Content["chatHistory.groupBy.dropdown.tooltip"],
			offset: { top: -34, right: -28 },
		});
	};

	const handlePointerEnter = (event: React.PointerEvent<HTMLElement>) => {
		if (event.pointerType !== "mouse") {
			return;
		}
		handleShowTooltip(event);
	};

	const handleFocus = (event: React.FocusEvent<HTMLElement>) => {
		if (!event.currentTarget.matches(":focus-visible")) {
			return;
		}
		handleShowTooltip(event);
	};

	const handleToggleDropdown = () => {
		hideTooltip();
		if (!isDropdownOpen) {
			const rect = selectButtonRef.current?.getBoundingClientRect();
			if (rect) {
				setDropdownPosition({ top: rect.bottom + 4, left: rect.left });
			}
		}
		setIsDropdownOpen(!isDropdownOpen);
	};

	const handleClose = useCallback(() => {
		setIsDropdownOpen(false);
		setIsGroupBySubmenuOpen(false);
		selectButtonRef.current?.focus();
	}, []);

	useClickOutside(isDropdownOpen, handleClose, [selectButtonRef, dropdownRef]);

	const refocusGroupByRowRef = useRef(false);

	const openGroupBySubmenu = () => setIsGroupBySubmenuOpen(true);
	const closeGroupBySubmenu = () => {
		if (isMobile) {
			refocusGroupByRowRef.current = true;
		}
		setIsGroupBySubmenuOpen(false);
	};

	const handleDeleteAll = () => {
		handleClose();
		showDeleteAllChatsDialog();
	};

	const handleTopLevelItemSelect = (id: TopLevelMenuItemId) => {
		if (id === "groupBy") {
			openGroupBySubmenu();
			return;
		}
		handleDeleteAll();
	};

	const { optionButtonRefs, handleKeyDown: handleDropdownKeyDown } =
		useDropdownKeyboard({
			items: topLevelMenuItems,
			isOpen: isDropdownOpen,
			onClose: handleClose,
			onItemClick: handleTopLevelItemSelect,
		});

	const handleGroupByKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key === "ArrowRight") {
			event.preventDefault();
			openGroupBySubmenu();
		}
	};

	const setOptionRef = (index: number) => (el: HTMLButtonElement | null) => {
		if (el) {
			optionButtonRefs.current.set(index, el);
		} else {
			optionButtonRefs.current.delete(index);
		}
	};

	return (
		<div className="relative">
			<button
				ref={selectButtonRef}
				type="button"
				className="hover:bg-dunkelblau-90 text-2xl rounded-3px size-6 flex items-center justify-center focus-visible:outline-default md:mr-2"
				aria-expanded={isDropdownOpen}
				aria-haspopup="menu"
				aria-label={Content["chatHistory.groupBy.dropdown.ariaLabel"]}
				onClick={handleToggleDropdown}
				onPointerEnter={handlePointerEnter}
				onPointerLeave={hideTooltip}
				onFocus={handleFocus}
				onBlur={hideTooltip}
			>
				<SettingsIcon />
			</button>
			{isDropdownOpen && (
				<div
					ref={dropdownRef}
					className={`absolute right-0 top-7 z-10 md:fixed md:right-auto md:z-50 min-w-max flex flex-col bg-hellblau-30 rounded-3px p-1 shadow-md`}
					style={!isMobile && dropdownPosition ? dropdownPosition : undefined}
					onKeyDown={handleDropdownKeyDown}
					role="menu"
					aria-label={Content["chatHistory.groupBy.dropdown.menuAriaLabel"]}
				>
					{isMobile && isGroupBySubmenuOpen ? (
						<HistoryGroupBySubmenu
							isOpen={isGroupBySubmenuOpen}
							onClose={closeGroupBySubmenu}
							onItemSelect={handleClose}
							groupByButtonRef={groupByRowRef}
							variant="inline"
						/>
					) : (
						<ul role="none" className="flex flex-col">
							<li role="none" onMouseEnter={openGroupBySubmenu}>
								<MenuRow
									label={Content["chatHistory.groupBy.dropdown.label"]}
									ariaLabel={Content["chatHistory.groupBy.dropdown.label"]}
									isSelected={false}
									isActive={isGroupBySubmenuOpen}
									onClick={openGroupBySubmenu}
									onKeyDown={handleGroupByKeyDown}
									optionButtonRef={(el) => {
										setOptionRef(0)(el);
										groupByRowRef.current = el;
										if (el && refocusGroupByRowRef.current) {
											refocusGroupByRowRef.current = false;
											el.focus();
										}
									}}
									hasSubmenu
								/>
								{!isMobile && isGroupBySubmenuOpen && (
									<div className="absolute top-0 left-full ml-2.5">
										<HistoryGroupBySubmenu
											isOpen={isGroupBySubmenuOpen}
											onClose={closeGroupBySubmenu}
											onItemSelect={handleClose}
											groupByButtonRef={groupByRowRef}
										/>
									</div>
								)}
							</li>
							<li role="separator" className="px-1.5 py-0.5">
								<div className="h-px bg-hellblau-100" />
							</li>
							<li role="none">
								<button
									type="button"
									ref={setOptionRef(1)}
									className={`flex items-center gap-1 text-sm w-full px-3 py-2 rounded-3px focus-visible:outline-default hover:bg-warning-50 text-warning-120`}
									role="menuitem"
									onClick={handleDeleteAll}
									onMouseEnter={closeGroupBySubmenu}
								>
									<BucketIcon className="size-5" />
									{Content["chatHistory.deleteAll.label"]}
								</button>
							</li>
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
