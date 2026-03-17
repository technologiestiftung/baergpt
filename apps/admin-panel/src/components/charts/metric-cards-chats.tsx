import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductDashboardStats } from "@/components/charts/types.ts";
import Content from "@/content.ts";

export function MetricCardsChats({ data }: { data: ProductDashboardStats }) {
	const {
		total_chats,
		total_user_documents,
		average_inferences_per_user,
		total_messages_with_documents,
		total_messages_without_documents,
	} = data;

	const metrics = [
		{
			label: Content["productDashboard.metricCards.totalChats.label"],
			currentValue: total_chats,
		},
		{
			label: Content["productDashboard.metricCards.totalUserDocuments.label"],
			currentValue: total_user_documents,
		},
		{
			label:
				Content["productDashboard.metricCards.averageInferencesPerUser.label"],
			currentValue: average_inferences_per_user,
		},
		{
			label:
				Content[
					"productDashboard.metricCards.totalMessagesWithDocuments.label"
				],
			currentValue: total_messages_with_documents,
		},
		{
			label:
				Content[
					"productDashboard.metricCards.totalMessagesWithoutDocuments.label"
				],
			currentValue: total_messages_without_documents,
		},
	];

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
			{metrics.map(({ label, currentValue }) => (
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
					</CardContent>
				</Card>
			))}
		</div>
	);
}
