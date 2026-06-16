import React, { useState } from "react";
import { Layout } from "../../components/layout/layout.tsx";
import { AdminSidebar } from "../../components/admin-sidebar/admin-sidebar.tsx";
import { AddNewDomainForm } from "../../components/add-new-domain-form/add-new-domain-form.tsx";
import { columns } from "../../components/add-new-domain-form/columns.tsx";
import { Content } from "@/content.ts";
import { useDomainStore } from "@/store/use-domain-store.ts";
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
import type { AllowedEmailDomain } from "@/common.ts";
import { PaginationControls } from "@/components/shared/table/pagination-controls.tsx";
import { PageSizeDropdown } from "@/components/shared/table/page-size-dropdown.tsx";
import { SearchField } from "@/components/shared/table/search-field.tsx";
import { FilterDropdown } from "@/components/shared/table/filter-dropdown.tsx";
import { TableContent } from "@/components/shared/table/table-content.tsx";

const DOMAIN_STATUS_OPTIONS = ["Alle", "Aktiv", "Inaktiv"];

export const DomainAllowlistPage: React.FC = () => {
	const allowedEmailDomains = useDomainStore(
		(state) => state.allowedEmailDomains,
	);
	const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [globalFilter, setGlobalFilter] = useState("");

	const table = useReactTable<AllowedEmailDomain>({
		data: allowedEmailDomains,
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
				domain = "",
				added_by_user = "",
				is_active = "",
			} = row.original as AllowedEmailDomain;
			const query = filterValue.toLowerCase();
			if (!query) {
				return true;
			}
			const queryWords = query.split(/\s+/).filter((word) => word.length > 0);
			const searchableFields = [
				domain?.toLowerCase() || "",
				added_by_user?.toLowerCase() || "",
				is_active?.toString() || "",
			];
			const result = queryWords.every((word) =>
				searchableFields.some((field) => field.includes(word)),
			);

			return result;
		},
	});

	const activeDomains = allowedEmailDomains.filter(
		(domain) => domain.is_active,
	);
	const deactivatedDomains = allowedEmailDomains.filter(
		(domain) => !domain.is_active,
	);

	return (
		<Layout>
			<AdminSidebar>
				<div className="w-full max-w-screen-xl p-4">
					<AddNewDomainForm />
					<div className="flex flex-row items-center justify-between w-full gap-4">
						<div className="w-full bg-white border border-gray-200 rounded-lg p-4">
							<div className="text-2xl font-bold text-dunkelblau-200 mb-0.5">
								{allowedEmailDomains.length}
							</div>
							<div className="text-gray-500 text-sm">
								{Content["domainAllowlistTable.count.label"]}
							</div>
						</div>
						<div className="w-full bg-white border border-gray-200 rounded-lg p-4">
							<div className="text-2xl font-bold text-dunkelblau-200 mb-0.5">
								{activeDomains.length}
							</div>
							<div className="text-gray-500 text-sm">
								{Content["domainAllowlistTable.active.label"]}
							</div>
						</div>
						<div className="w-full bg-white border border-gray-200 rounded-lg p-4">
							<div className="text-2xl font-bold text-dunkelblau-200 mb-0.5">
								{deactivatedDomains.length}
							</div>
							<div className="text-gray-500 text-sm">
								{Content["domainAllowlistTable.deactivated.label"]}
							</div>
						</div>
					</div>
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-4 text-dunkelblau-200">
						<SearchField
							value={globalFilter}
							onChange={setGlobalFilter}
							placeholder={
								Content["domainAllowlistTable.searchField.placeholder"]
							}
						/>
						<div className="flex justify-between items-center w-full">
							<FilterDropdown
								table={table}
								columnId="is_active"
								options={DOMAIN_STATUS_OPTIONS}
							/>
						</div>
					</div>
					<TableContent table={table} />

					<div className="flex flex-wrap justify-between items-center w-full gap-2">
						<PageSizeDropdown table={table} />
						<PaginationControls table={table} />
					</div>
				</div>
			</AdminSidebar>
		</Layout>
	);
};
