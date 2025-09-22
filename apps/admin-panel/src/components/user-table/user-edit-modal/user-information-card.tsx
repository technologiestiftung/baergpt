import React from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/use-user-store";
import Content from "../../../content";
import { Badge } from "@/components/ui/badge";
import { badgeColors } from "../columns";
import { cn } from "@/lib/utils";

export const UserInformationCard: React.FC = () => {
	const { selectedUser } = useUserStore();

	return (
		<Card className="w-full">
			<CardHeader>
				<CardTitle>
					{Content["userEditModal.userInformationCard.title"]}
				</CardTitle>
				<CardDescription>
					{Content["userEditModal.userInformationCard.description"]}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label className="text-sm font-medium">
						{Content["userEditModal.userInformationCard.registeredAt"]}
					</Label>
					<div className="text-sm text-muted-foreground">
						{selectedUser?.registered_at
							? new Date(selectedUser.registered_at).toLocaleDateString(
									"de-DE",
									{
										year: "numeric",
										month: "long",
										day: "numeric",
									},
								)
							: ""}
					</div>
				</div>

				<div className="space-y-2">
					<Label className="text-sm font-medium">
						{Content["userEditModal.userInformationCard.lastLoginAt"]}
					</Label>
					<div className="text-sm text-muted-foreground">
						{selectedUser?.last_login_at
							? new Date(selectedUser.last_login_at).toLocaleDateString(
									"de-DE",
									{
										year: "numeric",
										month: "long",
										day: "numeric",
									},
								)
							: ""}
					</div>
				</div>

				<div className="space-y-2">
					<Label className="text-sm font-medium">
						{Content["userEditModal.userInformationCard.inferences"]}
					</Label>
					<div className="text-sm text-muted-foreground">
						{selectedUser?.num_inferences?.toLocaleString()}{" "}
						{Content["userEditModal.userInformationCard.requests"]}
					</div>
				</div>
				<div className="space-y-2">
					<Label className="text-sm font-medium">
						{Content["userEditModal.userInformationCard.documents"]}
					</Label>
					<div className="text-sm text-muted-foreground">
						{selectedUser?.num_documents?.toLocaleString()}{" "}
					</div>
				</div>
				<div className="space-y-2">
					<Label className="text-sm font-medium">
						{Content["userEditModal.userInformationCard.accountStatus"]}
					</Label>
					<div className="text-sm text-muted-foreground">
						{selectedUser?.deleted_at ? (
							<>
								<span>
									{
										Content[
											"userEditModal.userInformationCard.accountStatus.deactivated"
										]
									}
								</span>{" "}
								{new Date(selectedUser.deleted_at).toLocaleDateString("de-DE", {
									year: "numeric",
									month: "long",
									day: "numeric",
								})}
							</>
						) : (
							<div className="flex space-x-2">
								<Badge
									variant="outline"
									className={cn(
										"capitalize",
										badgeColors.get(selectedUser?.status),
									)}
								>
									{selectedUser?.status || "active"}
								</Badge>
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
