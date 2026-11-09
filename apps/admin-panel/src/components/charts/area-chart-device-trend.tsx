import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart-container.tsx";
import type { MatomoDeviceMonthlyTrendPoint } from "@/components/charts/types.ts";
import Content from "@/content.ts";

const chartConfig = {
	desktop: {
		label: Content["productDashboard.matomo.deviceBreakdown.desktop.label"],
		color: "hsl(var(--chart-1))",
	},
	mobile: {
		label: Content["productDashboard.matomo.deviceBreakdown.mobile.label"],
		color: "hsl(var(--chart-2))",
	},
	tablet: {
		label: Content["productDashboard.matomo.deviceBreakdown.tablet.label"],
		color: "hsl(var(--chart-3))",
	},
} satisfies ChartConfig;

// Parse as local date; new Date("YYYY-MM-DD") is UTC and shifts the month west of UTC.
function formatMonth(value: string, options: Intl.DateTimeFormatOptions) {
	const [year, month, day] = value.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("de-DE", options);
}

export function AreaChartDeviceTrend({
	data,
}: {
	data: MatomoDeviceMonthlyTrendPoint[];
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					{Content["productDashboard.matomo.deviceBreakdown.title"]}
				</CardTitle>
				<CardDescription>
					{Content["productDashboard.matomo.deviceBreakdown.description"]}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-[250px] w-full"
				>
					<AreaChart data={data} margin={{ left: 12, right: 12 }}>
						<defs>
							{(["desktop", "mobile", "tablet"] as const).map((key) => (
								<linearGradient
									key={key}
									id={`fill-${key}`}
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor={`var(--color-${key})`}
										stopOpacity={0.8}
									/>
									<stop
										offset="95%"
										stopColor={`var(--color-${key})`}
										stopOpacity={0.1}
									/>
								</linearGradient>
							))}
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="month"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value) => formatMonth(value, { month: "short" })}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									indicator="dot"
									labelFormatter={(value) =>
										formatMonth(value, { month: "long", year: "numeric" })
									}
								/>
							}
						/>
						<Area
							dataKey="desktop"
							type="natural"
							fill="url(#fill-desktop)"
							fillOpacity={0.4}
							stroke="var(--color-desktop)"
						/>
						<Area
							dataKey="mobile"
							type="natural"
							fill="url(#fill-mobile)"
							fillOpacity={0.4}
							stroke="var(--color-mobile)"
						/>
						<Area
							dataKey="tablet"
							type="natural"
							fill="url(#fill-tablet)"
							fillOpacity={0.4}
							stroke="var(--color-tablet)"
						/>
						<ChartLegend content={<ChartLegendContent />} />
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
