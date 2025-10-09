import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import type { User } from "../../../common";
import Content from "../../../content";

const STATUSES = [
	Content["userTable.statusFilterDropdown.all.label"],
	"Active",
	"Inactive",
	"Admin",
	"Invited",
];
const DEFAULT_STATUS = Content["userTable.statusFilterDropdown.all.label"];

export function StatusFilterDropdown({ table }: { table: Table<User> }) {
	const statusColumn = table.getColumn("status");
	const selectedStatus = statusColumn?.getFilterValue() as string | undefined;

	const handleStatusChange = (status: string, checked: boolean) => {
		const newValue = status === DEFAULT_STATUS || !checked ? undefined : status;
		statusColumn?.setFilterValue(newValue);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline">
					{selectedStatus || DEFAULT_STATUS}
					<ChevronDown className="ml-2 h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align="start"
				className={
					selectedStatus && selectedStatus !== DEFAULT_STATUS ? "bg-muted" : ""
				}
			>
				{STATUSES.map((status) => {
					const isChecked =
						(!selectedStatus && status === DEFAULT_STATUS) ||
						selectedStatus === status;

					return (
						<DropdownMenuCheckboxItem
							key={status}
							checked={isChecked}
							onCheckedChange={(checked) => handleStatusChange(status, checked)}
						>
							{status}
						</DropdownMenuCheckboxItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
