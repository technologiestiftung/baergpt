"use client";

import { useState } from "react";
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	getPaginationRowModel,
	getFilteredRowModel,
	type SortingState,
	type ColumnFiltersState,
	type VisibilityState,
} from "@tanstack/react-table";
import { columns } from "./columns";
import { Content } from "../../content";

import { SearchField } from "../shared/table/search-field";
import { FilterDropdown } from "../shared/table/filter-dropdown";
import { PageSizeDropdown } from "../shared/table/page-size-dropdown";
import { TableContent } from "../shared/table/table-content";
import { PaginationControls } from "../shared/table/pagination-controls";

const USER_STATUS_OPTIONS = [
	Content["userTable.statusFilterDropdown.all.label"],
	"Active",
	"Banned",
	"Admin",
];
import type { User } from "../../common";
import { useUserStore } from "../../store/use-user-store";

export function UsersTable() {
	const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [globalFilter, setGlobalFilter] = useState("");
	const users = useUserStore((state) => state.users);
	const table = useReactTable<User>({
		data: users,
		columns,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			globalFilter,
			pagination,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		globalFilterFn: (row, _columnId, filterValue: string) => {
			const {
				first_name = "",
				last_name = "",
				email = "",
			} = row.original as User;
			const query = filterValue.toLowerCase();
			if (!query) {
				return true;
			}

			const queryWords = query.split(/\s+/).filter((word) => word.length > 0);

			const searchableFields = [
				first_name?.toLowerCase() || "",
				last_name?.toLowerCase() || "",
				email?.toLowerCase() || "",
			];

			const result = queryWords.every((word) =>
				searchableFields.some((field) => field.includes(word)),
			);

			return result;
		},
	});

	return (
		<div className="w-full max-w-screen-xl mx-5">
			<div className="max-w-60 bg-white border border-gray-200 rounded-lg p-4">
				<div className="text-2xl font-bold text-dunkelblau-200 mb-0.5">
					{table.getFilteredRowModel().rows.length}{" "}
					{Content["userTable.resultsCount.separator"]} {users.length}
				</div>
				<div className="text-gray-500 text-sm">
					{Content["userTable.resultsCount.label"]}
				</div>
			</div>

			<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4 text-dunkelblau-200">
				<SearchField
					value={globalFilter}
					onChange={setGlobalFilter}
					placeholder={Content["userTable.searchField.placeholder"]}
				/>
				<div className="flex justify-between items-center w-full">
					<FilterDropdown
						table={table}
						columnId="status"
						options={USER_STATUS_OPTIONS}
					/>
				</div>
			</div>
			<TableContent table={table} />

			<div className="flex flex-wrap justify-between items-center w-full gap-2">
				<PageSizeDropdown table={table} />
				<PaginationControls table={table} />
			</div>
		</div>
	);
}
