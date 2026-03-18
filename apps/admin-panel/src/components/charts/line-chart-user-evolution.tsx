import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	XAxis,
	YAxis,
	Legend,
} from "recharts";

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
import type { DailyUsers } from "@/components/charts/types.ts";
import Content from "@/content.ts";

const chartConfig = {
	total: {
		label: Content["productDashboard.userEvolution.total.label"],
	},
	new: {
		label: Content["productDashboard.userEvolution.new.label"],
	},
} satisfies ChartConfig;

export function LineChartUserEvolution({
	data,
}: {
	data: DailyUsers[] | undefined;
}) {
	return (
		<Card className="py-0">
			<CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
				<div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-0!">
					<CardTitle>
						{Content["productDashboard.userEvolution.title"]}
					</CardTitle>
					<CardDescription>
						{Content["productDashboard.userEvolution.description"]}
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent className="px-2 sm:p-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<ComposedChart
						accessibilityLayer
						data={data}
						margin={{
							left: 12,
							right: 12,
							top: 6,
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value) => {
								const date = new Date(value);
								return date.toLocaleDateString("de-DE", {
									month: "short",
									day: "numeric",
								});
							}}
						/>
						<YAxis
							yAxisId="total"
							orientation="right"
							tickLine={false}
							axisLine={false}
						/>
						<YAxis
							yAxisId="new"
							orientation="left"
							tickLine={false}
							axisLine={false}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									className="w-[150px]"
									nameKey="total,new"
									labelFormatter={(value) => {
										return new Date(value).toLocaleDateString("de-DE", {
											month: "short",
											day: "numeric",
											year: "numeric",
										});
									}}
								/>
							}
						/>
						<Legend
							verticalAlign="bottom"
							height={36}
							formatter={(value) =>
								value === "total"
									? chartConfig.total.label
									: chartConfig.new.label
							}
						/>
						<Bar yAxisId="new" dataKey="new" fill="hsl(160, 60%, 45%)" />
						<Line
							yAxisId="total"
							dataKey="total"
							stroke="hsl(221, 83%, 53%)"
							strokeWidth={2.5}
							dot={true}
							type="monotone"
						/>
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
