import { Button } from "@/components/ui/button";
import type { Table } from "@tanstack/react-table";
import Content from "../../../content";

export function PaginationControls<TData>({ table }: { table: Table<TData> }) {
	return (
		<div className="flex items-center justify-end space-x-2 py-4">
			<Button
				variant="outline"
				size="sm"
				onClick={() => table.previousPage()}
				disabled={!table.getCanPreviousPage()}
			>
				{Content["table.pagination.previousPage"]}
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() => table.nextPage()}
				disabled={!table.getCanNextPage()}
			>
				{Content["table.pagination.nextPage"]}
			</Button>
		</div>
	);
}
