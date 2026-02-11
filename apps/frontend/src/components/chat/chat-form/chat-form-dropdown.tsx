import Content from "../../../content";
import type {
	LlmModel,
	ChatOptionsDropdownValue,
	McpOptions,
} from "../../../common";
import { useDropdownKeyboard } from "../../../hooks/use-dropdown-keyboard";
import { MCP_OPTIONS_VALUES } from "./mcp-options-dialog.tsx";

interface ChatFormDropdownProps<T extends LlmModel | ChatOptionsDropdownValue> {
	title: string;
	items: {
		label: string;
		value: T;
		description: string;
		ariaLabel: string;
	}[];
	selectedItems: T[];
	onItemClick: (value: T) => void;
	className?: string;
	isOpen: boolean;
	onClose: () => void;
}

export const ChatFormDropdown = <
	T extends LlmModel | ChatOptionsDropdownValue,
>({
	items,
	title,
	selectedItems,
	onItemClick,
	className,
	isOpen,
	onClose,
}: ChatFormDropdownProps<T>) => {
	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items,
		isOpen,
		onClose,
		onItemClick: (item) => onItemClick(item.value),
	});

	const isMcpOptionSelected = selectedItems.some((selectedItem) =>
		Object.values(MCP_OPTIONS_VALUES).includes(selectedItem as McpOptions),
	);

	return (
		<div
			className={`z-50 absolute bottom-full rounded-3px bg-white border border-hellblau-50 pt-3 focus-visible:outline-default shadow-md min-w-[280px] mb-1 ${className}`}
			onKeyDown={handleKeyDown}
			role="listbox"
		>
			<div className="pb-3 px-4 border-b border-hellblau-50 text-dunkelblau-80 text-sm leading-6">
				{title}
			</div>
			<ul className="flex flex-col">
				{items.map((item, index) => {
					const isSelected =
						selectedItems.includes(item.value) ||
						(item.value === "mcpServer" && isMcpOptionSelected);

					return (
						<li key={item.value}>
							<button
								type="button"
								ref={(el) => {
									// set ref for each option button
									if (el) {
										optionButtonRefs.current.set(index, el);
									} else {
										optionButtonRefs.current.delete(index);
									}
								}}
								className="flex items-center justify-between w-full px-4 py-3 text-left gap-6 hover:bg-hellblau-30 focus-visible:outline-default rounded-3px"
								onClick={() => onItemClick(item.value)}
								aria-label={item.ariaLabel}
								role="option"
								aria-selected={isSelected}
							>
								<div>
									<div
										className={`text-sm leading-6 ${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"}`}
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
