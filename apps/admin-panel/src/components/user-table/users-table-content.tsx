import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../../components/ui/table";
import { flexRender, type Table as ReactTable } from "@tanstack/react-table";
import { columns } from "./columns";
import type { User } from "../../common";
import { ChevronLargeIcon } from "../../components/primitives/icons/chevron-large-icon";
import Content from "../../content";

export function UsersTableContent({ table }: { table: ReactTable<User> }) {
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									onClick={header.column.getToggleSortingHandler()}
									className="cursor-pointer select-none text-dunkelblau-200 font-semibold hover:bg-gray-100 first:pl-3"
								>
									<span className="w-full flex gap-1 items-center">
										{flexRender(
											header.column.columnDef.header,
											header.getContext(),
										)}
										<span className="size-3 flex items-center justify-center">
											{{
												asc: <ChevronLargeIcon direction="up" />,
												desc: <ChevronLargeIcon direction="down" />,
											}[header.column.getIsSorted() as string] ?? null}
										</span>
									</span>
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody className="text-dunkelblau-200">
					{table.getRowModel().rows.length ? (
						table.getRowModel().rows.map((row) => (
							<TableRow key={row.id}>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id} className="first:pl-3">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					) : (
						<TableRow>
							<TableCell colSpan={columns.length} className="h-24 text-center">
								{Content["userTable.noResults"]}
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
