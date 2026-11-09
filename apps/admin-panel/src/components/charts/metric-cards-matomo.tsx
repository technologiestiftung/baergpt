import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendIndicator } from "@/components/ui/trend-indicator.tsx";
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
	previousAverageSessionDurationSeconds,
	profilePageViews,
	previousProfilePageViews,
}: Pick<
	MatomoDashboardStats,
	| "averageSessionDurationSeconds"
	| "previousAverageSessionDurationSeconds"
	| "profilePageViews"
	| "previousProfilePageViews"
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
			current: averageSessionDurationSeconds,
			previous: previousAverageSessionDurationSeconds,
		},
		{
			label:
				Content["productDashboard.matomo.metricCards.profilePageViews.label"],
			details:
				Content["productDashboard.matomo.metricCards.profilePageViews.details"],
			currentValue: profilePageViews.toLocaleString("de-DE"),
			current: profilePageViews,
			previous: previousProfilePageViews,
		},
	];

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
			{metrics.map(({ label, details, currentValue, current, previous }) => (
				<Card key={label}>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							{label}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-4xl font-bold">{currentValue}</span>
							<TrendIndicator current={current} previous={previous} />
						</div>
						{details && (
							<p className="text-xs text-muted-foreground mt-1">{details}</p>
						)}
					</CardContent>
				</Card>
			))}
		</div>
	);
}
