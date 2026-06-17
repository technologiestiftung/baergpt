import type { ColumnDef } from "@tanstack/react-table";
import type { AllowedEmailDomain } from "@/common";
import { Content } from "@/content";
import { Button } from "@/components/ui/button";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { useDomainStore } from "@/store/use-domain-store";
import { formatDate } from "../user-table/utils/format-date";

export const badgeColors = new Map<AllowedEmailDomain["is_active"], string>([
	[true, "bg-green-100/50 text-green-700 dark:text-green-300 border-none"],
	[false, "bg-red-100/30 text-red-600 dark:text-red-200 border-none"],
]);

export const columns: ColumnDef<AllowedEmailDomain>[] = [
	{
		header: Content["domainAllowlistTable.tableHeader.domain"],
		accessorKey: "domain",
	},
	{
		header: Content["domainAllowlistTable.tableHeader.userCount"],
		accessorKey: "user_count",
	},
	{
		header: Content["domainAllowlistTable.tableHeader.dateAdded"],
		accessorKey: "created_at",
		cell: ({ getValue }) => formatDate(getValue() as string),
	},
	{
		header: Content["domainAllowlistTable.tableHeader.addedBy"],
		accessorKey: "created_by",
	},
	{
		header: Content["domainAllowlistTable.tableHeader.isActive"],
		accessorKey: "is_active",
		enableColumnFilter: true,
		filterFn: (row, _columnId, filterValue: string) => {
			if (
				!filterValue ||
				filterValue ===
					Content["domainAllowlistTable.statusFilterDropdown.all.label"]
			) {
				return true;
			}
			if (
				filterValue ===
				Content["domainAllowlistTable.statusFilterDropdown.active.label"]
			) {
				return row.original.is_active === true;
			}
			if (
				filterValue ===
				Content["domainAllowlistTable.statusFilterDropdown.inactive.label"]
			) {
				return row.original.is_active === false;
			}
			return true;
		},
		cell: ({ row }) => {
			const { is_active } = row.original;
			const badgeColor = badgeColors.get(is_active);

			return (
				<div className="flex space-x-2">
					<Badge variant="outline" className={cn("capitalize", badgeColor)}>
						{is_active
							? Content["domainAllowlistTable.tableHeader.isActive.active"]
							: Content["domainAllowlistTable.tableHeader.isActive.inactive"]}
					</Badge>
				</div>
			);
		},
	},
	{
		header: Content["domainAllowlistTable.tableHeader.lastStatusChange"],
		accessorKey: "last_status_change_at",
		cell: ({ getValue }) => formatDate(getValue() as string),
	},
	{
		header: Content["domainAllowlistTable.tableHeader.lastStatusChangeBy"],
		accessorKey: "last_status_change_by",
	},
	{
		header: Content["domainAllowlistTable.tableHeader.actions"],
		accessorKey: "actions",
		cell: ({ row }) => {
			const { is_active } = row.original;

			return (
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						const { setSelectedDomain, setChangeDomainStatusDialogOpen } =
							useDomainStore.getState();
						setSelectedDomain(row.original);
						setChangeDomainStatusDialogOpen(true);
					}}
				>
					{is_active
						? Content["domainAllowlistTable.tableHeader.actions.deactivate"]
						: Content["domainAllowlistTable.tableHeader.actions.activate"]}
				</Button>
			);
		},
	},
];
