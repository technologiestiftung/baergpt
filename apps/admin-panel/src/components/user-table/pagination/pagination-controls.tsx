import { Button } from "@/components/ui/button";
import { Table } from "@tanstack/react-table";
import { User } from "../../../common";
import Content from "../../../content";

export function PaginationControls({ table }: { table: Table<User> }) {
	return (
		<div className="flex items-center justify-end space-x-2 py-4">
			<Button
				variant="outline"
				size="sm"
				onClick={() => table.previousPage()}
				disabled={!table.getCanPreviousPage()}
			>
				{Content["userTable.pagination.previousPage"]}
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() => table.nextPage()}
				disabled={!table.getCanNextPage()}
			>
				{Content["userTable.pagination.nextPage"]}
			</Button>
		</div>
	);
}
