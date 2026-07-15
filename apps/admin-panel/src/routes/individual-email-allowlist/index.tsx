import React, { useState } from "react";
import { Layout } from "../../components/layout/layout.tsx";
import { AdminSidebar } from "../../components/admin-sidebar/admin-sidebar.tsx";
import { AddIndividualEmailForm } from "../../components/edit-individual-emails/add-individual-email-form";
import { columns } from "../../components/edit-individual-emails/columns";
import { Content } from "@/content.ts";
import { useIndividualEmailStore } from "@/store/use-individual-email-store.ts";
import {
	useReactTable,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	getFilteredRowModel,
	type ColumnFiltersState,
	type SortingState,
	type VisibilityState,
} from "@tanstack/react-table";
import type { AllowedIndividualEmail } from "@/common.ts";
import { PaginationControls } from "@/components/shared/table/pagination-controls.tsx";
import { PageSizeDropdown } from "@/components/shared/table/page-size-dropdown.tsx";
import { SearchField } from "@/components/shared/table/search-field.tsx";
import { TableContent } from "@/components/shared/table/table-content.tsx";
import { RemoveIndividualEmailDialog } from "@/components/edit-individual-emails/remove-individual-email-dialog.tsx";

export const IndividualEmailAllowlistPage: React.FC = () => {
	const allowedIndividualEmails = useIndividualEmailStore(
		(state) => state.allowedIndividualEmails,
	);
	const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [globalFilter, setGlobalFilter] = useState("");

	const table = useReactTable<AllowedIndividualEmail>({
		data: allowedIndividualEmails,
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
			const { email = "", created_by = "" } =
				row.original as AllowedIndividualEmail;
			const query = filterValue.toLowerCase();
			if (!query) {
				return true;
			}

			const queryWords = query.split(/\s+/).filter((w) => w.length > 0);
			const fields = [email.toLowerCase(), created_by?.toLowerCase() ?? ""];
			return queryWords.every((word) => fields.some((f) => f.includes(word)));
		},
	});

	return (
		<Layout>
			<AdminSidebar>
				<div className="w-full max-w-screen-xl p-4">
					<AddIndividualEmailForm />
					<div className="flex flex-row items-center justify-between w-full gap-4">
						<div className="w-full bg-white border border-gray-200 rounded-lg p-4">
							<div className="text-2xl font-bold text-dunkelblau-200 mb-0.5">
								{allowedIndividualEmails.length}
							</div>
							<div className="text-gray-500 text-sm">
								{Content["individualEmailAllowlistTable.count.label"]}
							</div>
						</div>
					</div>
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4 text-dunkelblau-200">
						<SearchField
							value={globalFilter}
							onChange={setGlobalFilter}
							placeholder={
								Content["individualEmailAllowlistTable.searchField.placeholder"]
							}
						/>
					</div>
					<TableContent table={table} />
					<div className="flex flex-wrap justify-between items-center w-full gap-2">
						<PageSizeDropdown table={table} />
						<PaginationControls table={table} />
					</div>
				</div>
			</AdminSidebar>
			<RemoveIndividualEmailDialog />
		</Layout>
	);
};
