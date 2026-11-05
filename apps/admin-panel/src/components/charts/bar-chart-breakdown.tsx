import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

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

const BAR_SIZE = 20;
const BAR_GAP = 8;

export function BarChartBreakdown({
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
					className="aspect-auto w-full"
					style={{ height: data.length * (BAR_SIZE + BAR_GAP) }}
				>
					<BarChart
						accessibilityLayer
						data={data}
						layout="vertical"
						margin={{ left: 20, right: 0 }}
					>
						<XAxis type="number" dataKey="percentage" hide />
						<YAxis
							dataKey="label"
							type="category"
							tickLine={false}
							tickMargin={10}
							axisLine={false}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent hideLabel />}
						/>
						<Bar
							dataKey="percentage"
							fill="var(--color-percentage)"
							radius={5}
							barSize={BAR_SIZE}
						>
							<LabelList
								dataKey="percentage"
								position="right"
								offset={8}
								className="fill-foreground"
								fontSize={12}
								formatter={(value) => `${value}%`}
							/>
						</Bar>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
