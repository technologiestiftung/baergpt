import React, {
	useState,
	useRef,
	useCallback,
	type KeyboardEvent,
} from "react";
import { useClickOutside } from "../../../hooks/use-click-outside.ts";
import { useDropdownKeyboard } from "../../../hooks/use-dropdown-keyboard.ts";
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
	const [submenuPosition, setSubmenuPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const selectButtonRef = useRef<HTMLButtonElement>(null);
	const groupByRowRef = useRef<HTMLButtonElement | null>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const { showTooltip, hideTooltip } = useTooltipStore();

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
		setIsDropdownOpen(!isDropdownOpen);
	};

	const handleClose = useCallback(() => {
		setIsDropdownOpen(false);
		setIsGroupBySubmenuOpen(false);
		selectButtonRef.current?.focus();
	}, []);

	useClickOutside(isDropdownOpen, handleClose, [selectButtonRef, dropdownRef]);

	const openGroupBySubmenu = () => {
		const rect = dropdownRef.current?.getBoundingClientRect();
		if (rect) {
			// Wider than the submenu ever renders, so opening leftward (when
			// opening rightward would overflow the viewport, e.g. on mobile)
			// never needs a post-render re-measure/flicker
			const estimatedSubmenuWidth = 151;
			const gap = 10;
			const overflowsRight =
				rect.right + gap + estimatedSubmenuWidth > window.innerWidth;
			const left = overflowsRight
				? rect.left - estimatedSubmenuWidth - gap
				: rect.right + gap;
			setSubmenuPosition({ top: rect.top, left: Math.max(8, left) });
		}
		setIsGroupBySubmenuOpen(true);
	};
	const closeGroupBySubmenu = () => setIsGroupBySubmenuOpen(false);

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
				className="hover:bg-dunkelblau-90 text-2xl rounded-3px size-6 flex items-center justify-center focus-visible:outline-default mr-2"
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
					className="absolute right-0 z-10 min-w-max flex flex-col bg-hellblau-30 rounded-3px p-1 shadow-md"
					onKeyDown={handleDropdownKeyDown}
					role="menu"
					aria-label={Content["chatHistory.groupBy.dropdown.ariaLabel"]}
				>
					<ul role="none" className="flex flex-col">
						<li
							role="none"
							className="relative"
							onMouseEnter={openGroupBySubmenu}
						>
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
								}}
								hasSubmenu
							/>
							{isGroupBySubmenuOpen && submenuPosition && (
								<div
									className="fixed z-20"
									style={{
										top: submenuPosition.top,
										left: submenuPosition.left,
									}}
								>
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
				</div>
			)}
		</div>
	);
}
