import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart-container.tsx";
import type { MatomoPercentageEntry } from "@/components/charts/types.ts";

export function RadarChartBreakdown({
	title,
	description,
	seriesLabel,
	color,
	data,
}: {
	title: string;
	description: string;
	seriesLabel: string;
	color: string;
	data: MatomoPercentageEntry[];
}) {
	const chartConfig = {
		percentage: { label: seriesLabel, color },
	} satisfies ChartConfig;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<RadarChart data={data}>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent valueFormatter={(value) => `${value}%`} />
							}
						/>
						<PolarAngleAxis dataKey="label" />
						<PolarGrid />
						<Radar
							dataKey="percentage"
							fill="var(--color-percentage)"
							fillOpacity={0.6}
							stroke="var(--color-percentage)"
							dot={{ r: 4, fillOpacity: 1 }}
						/>
					</RadarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
