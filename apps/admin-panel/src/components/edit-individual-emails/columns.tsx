import type { ColumnDef } from "@tanstack/react-table";
import type { AllowedIndividualEmail } from "@/common";
import { Content } from "@/content";
import { Button } from "@/components/ui/button";
import { useIndividualEmailStore } from "@/store/use-individual-email-store";
import { formatDate } from "../user-table/utils/format-date";

export const columns: ColumnDef<AllowedIndividualEmail>[] = [
	{
		header: Content["individualEmailAllowlistTable.tableHeader.email"],
		accessorKey: "email",
	},
	{
		header: Content["individualEmailAllowlistTable.tableHeader.hasAccount"],
		accessorKey: "has_account",
		cell: ({ getValue }) =>
			getValue()
				? Content["individualEmailAllowlistTable.tableHeader.hasAccount.yes"]
				: Content["individualEmailAllowlistTable.tableHeader.hasAccount.no"],
	},
	{
		header: Content["individualEmailAllowlistTable.tableHeader.dateAdded"],
		accessorKey: "created_at",
		cell: ({ getValue }) => formatDate(getValue() as string | null),
	},
	{
		header: Content["individualEmailAllowlistTable.tableHeader.addedBy"],
		accessorKey: "created_by",
	},
	{
		header: Content["individualEmailAllowlistTable.tableHeader.actions"],
		accessorKey: "actions",
		cell: ({ row }) => (
			<Button
				variant="outline"
				size="sm"
				onClick={() => {
					const { setSelectedEmail, setRemoveEmailDialogOpen } =
						useIndividualEmailStore.getState();
					setSelectedEmail(row.original);
					setRemoveEmailDialogOpen(true);
				}}
			>
				{Content["individualEmailAllowlistTable.tableHeader.actions.remove"]}
			</Button>
		),
	},
];
