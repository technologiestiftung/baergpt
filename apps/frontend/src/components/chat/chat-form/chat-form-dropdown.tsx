import Content from "../../../content";
import type { LlmModel, ChatOption } from "../../../common";

interface ChatFormDropdownProps<T extends LlmModel | ChatOption> {
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
	disabledOptions?: T[];
}

export const ChatFormDropdown = <T extends LlmModel | ChatOption>({
	items,
	title,
	selectedItems,
	onItemClick,
	className,
	disabledOptions,
}: ChatFormDropdownProps<T>) => {
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
					const isDisabled = disabledOptions
						? disabledOptions.includes(item.value)
						: false;

					return (
						<li key={item.value}>
							<button
								type="button"
								className="flex items-center justify-between w-full px-4 py-3 text-left gap-6 hover:bg-hellblau-30 focus-visible:outline-default rounded-3px disabled:bg-hellblau-30 group disabled:cursor-not-allowed"
								onClick={() => onItemClick(item.value)}
								aria-label={item.ariaLabel}
								disabled={isDisabled}
							>
								<div>
									<div
										className={`text-sm leading-6 ${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"} group-disabled:text-dunkelblau-50`}
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
