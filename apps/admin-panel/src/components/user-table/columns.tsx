import { ColumnDef } from "@tanstack/react-table";
import { User } from "../../common";
import { Content } from "../../content";
import { useUserStore } from "../../store/use-user-store";
import { formatDate } from "./utils/format-date";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SquarePen } from "lucide-react";

export const badgeColors = new Map<User["status"], string>([
	[
		"active",
		"bg-emerald-100/50 text-emerald-700 dark:text-emerald-300 border-emerald-300",
	],
	[
		"inactive",
		"bg-amber-100/30 text-amber-600 dark:text-amber-200 border-amber-200",
	],
	["admin", "bg-slate-200 border-slate-400 text-slate-800"],
	[
		"invited",
		"bg-blue-100/50 text-blue-700 dark:text-blue-300 border-blue-300",
	],
]);

export const columns: ColumnDef<User>[] = [
	{
		accessorKey: "first_name",
		header: Content["userTable.tableHeader.firstName"],
		enableSorting: true,
	},
	{
		accessorKey: "last_name",
		header: Content["userTable.tableHeader.lastName"],
		enableSorting: true,
	},
	{
		accessorKey: "email",
		header: Content["userTable.tableHeader.email"],
		enableSorting: true,
	},
	{
		accessorKey: "registered_at",
		header: Content["userTable.tableHeader.registeredAt"],
		enableSorting: true,
		cell: ({ getValue }) => formatDate(getValue() as string),
	},
	{
		accessorKey: "last_login_at",
		header: Content["userTable.tableHeader.lastLoginAt"],
		enableSorting: true,
		cell: ({ getValue }) => formatDate(getValue() as string),
	},
	{
		accessorKey: "num_inferences",
		header: Content["userTable.tableHeader.inferences"],
		enableSorting: true,
	},
	{
		accessorKey: "num_documents",
		header: Content["userTable.tableHeader.documents"],
		enableSorting: true,
	},
	{
		accessorKey: "status",
		header: Content["userTable.tableHeader.status"],
		cell: ({ row }) => {
			const { status } = row.original;
			const badgeColor = badgeColors.get(status);

			return (
				<div className="flex space-x-2">
					<Badge variant="outline" className={cn("capitalize", badgeColor)}>
						{row.getValue("status")}
					</Badge>
				</div>
			);
		},
		enableColumnFilter: true,
		filterFn: (row, _columnId, filterValue: string) => {
			// Handle show all filter - show all users
			if (
				filterValue === Content["userTable.statusFilterDropdown.all.label"] ||
				!filterValue
			) {
				return true;
			}

			// Get the user's status
			const userStatus = row.original.status;

			return userStatus === filterValue.toLowerCase();
		},
	},
	{
		id: "actions",
		header: Content["userTable.tableHeader.actions"],
		cell: ({ row }) => (
			<button
				className="flex items-center rounded-3px focus-visible:outline-default size-5 hover:bg-gray-200"
				aria-label={Content["userTable.tableHeader.actions.ariaLabel"]}
				onClick={() => {
					const state = useUserStore.getState();
					if (state?.setSelectedUser) {
						state.setSelectedUser(row.original);
					}
				}}
			>
				<SquarePen className="inline-block size-4 my-1 ml-0.5" />
			</button>
		),
		enableSorting: false,
		enableColumnFilter: false,
	},
];
