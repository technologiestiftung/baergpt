import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { Table } from "@tanstack/react-table";

export function FilterDropdown<TData>({
	table,
	columnId,
	options,
}: {
	table: Table<TData>;
	columnId: string;
	options: string[];
}) {
	const defaultOption = options[0];
	const filterColumn = table.getColumn(columnId);
	const selectedValue = filterColumn?.getFilterValue() as string | undefined;

	const handleValueChange = (value: string, checked: boolean) => {
		const newValue = value === defaultOption || !checked ? undefined : value;
		filterColumn?.setFilterValue(newValue);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">
					{selectedValue || defaultOption}
					<ChevronDown className="ml-2 h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align="start"
				className={
					selectedValue && selectedValue !== defaultOption ? "bg-muted" : ""
				}
			>
				{options.map((option) => {
					const isChecked =
						(!selectedValue && option === defaultOption) ||
						selectedValue === option;

					return (
						<DropdownMenuCheckboxItem
							key={option}
							checked={isChecked}
							onCheckedChange={(checked) => handleValueChange(option, checked)}
						>
							{option}
						</DropdownMenuCheckboxItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
