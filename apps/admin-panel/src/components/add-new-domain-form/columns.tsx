import type { ColumnDef } from "@tanstack/react-table";
import type { AllowedEmailDomain } from "@/common";
import { Content } from "@/content";
import { Button } from "@/components/ui/button";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import { useDomainStore } from "@/store/use-domain-store";

export const badgeColors = new Map<AllowedEmailDomain["is_active"], string>([
	[true, "bg-green-100/50 text-green-700 dark:text-green-300 border-none"],
	[false, "bg-red-100/30 text-red-600 dark:text-red-200 border-none"],
]);

const handleToggleAllowedEmailDomain = async (
	domain: string,
	isActive: boolean,
) => {
	const { activateAllowedEmailDomain, deactivateAllowedEmailDomain } =
		useDomainStore.getState();

	if (isActive) {
		await deactivateAllowedEmailDomain(domain);
	} else {
		await activateAllowedEmailDomain(domain);
	}
};

export const columns: ColumnDef<AllowedEmailDomain>[] = [
	{
		header: Content["domainAllowlistTable.tableHeader.domain"],
		accessorKey: "domain",
	},
	{
		header: Content["domainAllowlistTable.tableHeader.dateAdded"],
		accessorKey: "created_at",
	},
	{
		header: Content["domainAllowlistTable.tableHeader.addedBy"],
		accessorKey: "created_by",
	},
	{
		header: Content["domainAllowlistTable.tableHeader.isActive"],
		accessorKey: "is_active",
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
		header: Content["domainAllowlistTable.tableHeader.actions"],
		accessorKey: "actions",
		cell: ({ row }) => {
			const { domain, is_active } = row.original;

			return (
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						handleToggleAllowedEmailDomain(domain, is_active).catch(
							console.error,
						);
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
