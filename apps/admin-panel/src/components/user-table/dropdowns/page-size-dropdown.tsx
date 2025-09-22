import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { ChevronDown } from "lucide-react";

import type { Table } from "@tanstack/react-table";
import { User } from "../../../common";
import Content from "../../../content";

export function PageSizeDropdown({ table }: { table: Table<User> }) {
	const sizes = [25, 50, 100];

	return (
		<div className="flex items-center gap-4 py-4">
			<span className="text-sm">
				{Content["userTable.PageSizeDropdown.pageSize.label"]}
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" className="w-[160px] justify-between">
						{table.getState().pagination.pageSize === Number.MAX_SAFE_INTEGER
							? Content["userTable.PageSizeDropdown.all.label"]
							: `${table.getState().pagination.pageSize} ${Content["userTable.PageSizeDropdown.perTable"]}`}
						<ChevronDown className="ml-2 h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					{sizes.map((pageSize) => (
						<DropdownMenuItem
							key={pageSize}
							onClick={() => table.setPageSize(pageSize)}
						>
							{pageSize} {Content["userTable.PageSizeDropdown.perTable"]}
						</DropdownMenuItem>
					))}
					<DropdownMenuItem
						onClick={() => table.setPageSize(Number.MAX_SAFE_INTEGER)}
					>
						{Content["userTable.PageSizeDropdown.all.label"]}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
