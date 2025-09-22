import React from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useUserStore } from "@/store/use-user-store";
import Content from "../../../content";

export const DangerZoneCard: React.FC = () => {
	const { selectedUser, setDeleteUserDialogOpen, setRestoreUserDialogOpen } =
		useUserStore();

	const isUserDeactivated =
		selectedUser && (!selectedUser.is_active || selectedUser.deleted_at);

	return (
		<Card className="border-red-200">
			<CardHeader>
				<CardTitle className="text-red-600">
					{Content["userEditModal.dangerZoneCard.title"]}
				</CardTitle>
				<CardDescription>
					{Content["userEditModal.dangerZoneCard.description"]}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Separator className="mb-4" />
				{/* Delete User Section */}
				<div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-6">
					<div>
						<h4 className="font-medium">
							{Content["userEditModal.dangerZoneCard.deleteUser.title"]}
						</h4>
						<p className="text-sm text-muted-foreground">
							{Content["userEditModal.dangerZoneCard.deleteUser.description"]}
						</p>
					</div>
					<Button
						variant="default"
						onClick={() => setDeleteUserDialogOpen?.(true)}
						className="ml-4"
					>
						<Trash2 className="h-4 w-4 mr-2" />
						{Content["userEditModal.dangerZoneCard.deleteUser.button"]}
					</Button>
				</div>

				{/* Restore User Section */}
				{isUserDeactivated && (
					<>
						<Separator className="mb-4" />
						<div className="flex flex-col md:flex-row gap-6 items-center justify-between">
							<div>
								<h4 className="font-medium text-green-600">
									{Content["userEditModal.dangerZoneCard.restoreUser.title"]}
								</h4>
								<p className="text-sm text-muted-foreground">
									{
										Content[
											"userEditModal.dangerZoneCard.restoreUser.description"
										]
									}
								</p>
							</div>
							<Button
								variant="default"
								onClick={() => setRestoreUserDialogOpen?.(true)}
								className="ml-4 bg-green-600 hover:bg-green-700 text-white"
							>
								<RotateCcw className="h-4 w-4 mr-2" />
								{Content["userEditModal.dangerZoneCard.restoreUser.button"]}
							</Button>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
};
