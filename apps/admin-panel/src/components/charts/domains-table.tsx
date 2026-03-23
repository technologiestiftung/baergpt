import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { ProductDashboardStats } from "@/components/charts/types.ts";
import { useState } from "react";
import Content from "@/content.ts";

export function DomainsTable({
	domains,
}: Pick<ProductDashboardStats, "domains">) {
	const [isShowingAll, setIsShowingAll] = useState(false);

	const hasMoreThanFiveDomains = domains.length > 5;
	const displayedDomains = isShowingAll ? domains : domains.slice(0, 5);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{Content["productDashboard.domainsTable.title"]}</CardTitle>
				<CardDescription>
					{Content["productDashboard.domainsTable.description"]}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>
								{Content["productDashboard.domainsTable.head.domain"]}
							</TableHead>
							<TableHead className="text-right">
								{Content["productDashboard.domainsTable.head.users"]}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{displayedDomains.map(({ domain, count }) => (
							<TableRow key={domain}>
								<TableCell>{domain}</TableCell>
								<TableCell className="text-right">
									{count.toLocaleString("de-DE")}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
			{hasMoreThanFiveDomains && !isShowingAll && (
				<CardFooter className="justify-center border-t pt-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsShowingAll(true)}
					>
						{Content["productDashboard.domainsTable.showAllButton"]} (
						{domains.length})
					</Button>
				</CardFooter>
			)}
		</Card>
	);
}
