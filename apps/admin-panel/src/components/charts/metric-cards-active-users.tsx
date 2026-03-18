import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductDashboardStats } from "@/components/charts/types.ts";
import Content from "@/content.ts";

export function MetricCardsActiveUsers({
	dau,
	wau,
	mau,
}: Pick<ProductDashboardStats, "dau" | "wau" | "mau">) {
	const metrics = [
		{
			label: Content["productDashboard.metricCards.dau.label"],
			details: Content["productDashboard.metricCards.dau.details"],
			currentValue: dau,
		},
		{
			label: Content["productDashboard.metricCards.wau.label"],
			details: Content["productDashboard.metricCards.wau.details"],
			currentValue: wau,
		},
		{
			label: Content["productDashboard.metricCards.mau.label"],
			details: Content["productDashboard.metricCards.mau.details"],
			currentValue: mau,
		},
	];

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{metrics.map(({ label, details, currentValue }) => (
				<Card key={label}>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<span className="text-4xl font-bold">
							{currentValue?.toLocaleString("de-DE") ?? "—"}
						</span>
						{details && (
							<p className="text-xs text-muted-foreground mt-1">{details}</p>
						)}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
