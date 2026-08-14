import React, { useEffect, useState } from "react";
import { useDropdownKeyboard } from "../../../../hooks/use-dropdown-keyboard";
import Content from "../../../../content";
import type { Chat } from "../../../../common";
import { showDeleteHistoryEntryDialog } from "../delete-history-entry/delete-history-entry-dialog";
import { useHistoryEntryDeleteStore } from "../../../../store/use-history-entry-delete-store";
import { DeleteElementIcon } from "../../../primitives/icons/delete-element-icon";

interface HistoryEntryDropdownProps {
	chat: Chat;
	isOpen: boolean;
	onClose: () => void;
	onRename: () => void;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export const HistoryEntryDropdown: React.FC<HistoryEntryDropdownProps> = ({
	chat,
	isOpen,
	onClose,
	onRename,
	triggerRef,
}) => {
	const { setHistoryEntryToDeleteId, setHistoryEntryToDeleteName } =
		useHistoryEntryDeleteStore();
	const [position, setPosition] = useState<{ top: number; right: number }>({
		top: 0,
		right: 0,
	});

	const calculatePosition = () => {
		if (triggerRef.current) {
			const rect = triggerRef.current.getBoundingClientRect();
			return { top: rect.bottom, right: window.innerWidth - rect.right };
		}
		return { top: 0, right: 0 };
	};

	useEffect(() => {
		if (isOpen) {
			setPosition(calculatePosition());

			const handleScroll = () => {
				setPosition(calculatePosition());
			};

			const scrollContainer = document.querySelector(".history-scrollbar");
			if (scrollContainer) {
				scrollContainer.addEventListener("scroll", handleScroll);
			}

			return () => {
				if (scrollContainer) {
					scrollContainer.removeEventListener("scroll", handleScroll);
				}
			};
		}
		return undefined;
	}, [isOpen, triggerRef]);

	const handleRename = () => {
		onClose();
		onRename();
	};

	const handleDelete = () => {
		onClose();
		setHistoryEntryToDeleteId(chat.id);
		setHistoryEntryToDeleteName(chat.name.replace(/[#`>*]/g, ""));
		showDeleteHistoryEntryDialog();
	};

	const dropdownItems = [
		{
			action: handleRename,
			label: Content["historyEntryDropdown.rename"],
			style: "text-dunkelblau-80",
			icon: (
				<img
					src="/icons/edit-dark-blue-icon.svg"
					alt={Content["historyEntryDropdown.rename.imgAlt"]}
					className="size-5"
					width={20}
					height={20}
				/>
			),
		},
		{
			action: handleDelete,
			label: Content["historyEntryDropdown.delete"],
			style: "group/delete text-warning-100 hover:text-dunkelblau-80",
			icon: <DeleteElementIcon />,
		},
	];

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items: dropdownItems,
		isOpen,
		onClose,
		onItemClick: (item) => item.action(),
	});

	if (!isOpen) {
		return null;
	}

	return (
		<div
			className="fixed z-50 w-fit bg-white rounded-3px shadow-custom-shadow shadow-dunkelblau-100/10 p-1"
			style={{ top: `${position.top}px`, right: `${position.right}px` }}
			onKeyDown={handleKeyDown}
			role="listbox"
		>
			<ul className="flex flex-col">
				{dropdownItems.map((item, index) => (
					<li key={item.label}>
						<button
							type="button"
							ref={(el) => {
								if (el) {
									optionButtonRefs.current.set(index, el);
								} else {
									optionButtonRefs.current.delete(index);
								}
							}}
							className={`flex items-center w-full h-9 pl-1.5 pr-3 py-1 gap-x-2 text-left rounded-3px focus-visible:outline-2px ${item.style}`}
							onClick={item.action}
							aria-label={item.label}
							role="option"
						>
							<div className="flex items-center justify-center rounded-3px shrink-0 size-8">
								{item.icon}
							</div>
							<span className="text-sm leading-5">{item.label}</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
};
