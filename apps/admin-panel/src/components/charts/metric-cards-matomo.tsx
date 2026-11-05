import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MatomoDashboardStats } from "@/components/charts/types.ts";
import Content from "@/content.ts";

function formatDuration(totalSeconds: number): string {
	const roundedSeconds = Math.round(totalSeconds);
	const minutes = Math.floor(roundedSeconds / 60);
	const seconds = roundedSeconds % 60;
	return `${minutes}min ${seconds.toString().padStart(2, "0")}s`;
}

export function MetricCardsMatomo({
	averageSessionDurationSeconds,
	profilePageViews,
}: Pick<
	MatomoDashboardStats,
	"averageSessionDurationSeconds" | "profilePageViews"
>) {
	const metrics = [
		{
			label:
				Content[
					"productDashboard.matomo.metricCards.averageSessionDuration.label"
				],
			details:
				Content[
					"productDashboard.matomo.metricCards.averageSessionDuration.details"
				],
			currentValue: formatDuration(averageSessionDurationSeconds),
		},
		{
			label:
				Content["productDashboard.matomo.metricCards.profilePageViews.label"],
			details:
				Content["productDashboard.matomo.metricCards.profilePageViews.details"],
			currentValue: profilePageViews.toLocaleString("de-DE"),
		},
	];

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{metrics.map(({ label, details, currentValue }) => (
				<Card key={label}>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<span className="text-4xl font-bold">{currentValue}</span>
						{details && (
							<p className="text-xs text-muted-foreground mt-1">{details}</p>
						)}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
