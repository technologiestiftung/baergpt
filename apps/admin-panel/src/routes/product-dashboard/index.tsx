import { Layout } from "@/components/layout/layout.tsx";
import { AdminSidebar } from "@/components/admin-sidebar/admin-sidebar.tsx";
import { LineChartUserEvolution } from "@/components/charts/line-chart-user-evolution.tsx";
import { MetricCardsActiveUsers } from "@/components/charts/metric-cards-active-users.tsx";
import { DomainsTable } from "@/components/charts/domains-table.tsx";
import { useProductDashboardData } from "@/hooks/use-product-dashboard-data.tsx";
import { useMatomoDashboardData } from "@/hooks/use-matomo-dashboard-data.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import Content from "@/content.ts";
import { MetricCardsChats } from "@/components/charts/metric-cards-chats.tsx";
import { MetricCardsMatomo } from "@/components/charts/metric-cards-matomo.tsx";
import { AreaChartDeviceTrend } from "@/components/charts/area-chart-device-trend.tsx";
import { RadarChartBreakdown } from "@/components/charts/radar-chart-breakdown.tsx";
import { BarChartBreakdown } from "@/components/charts/bar-chart-breakdown.tsx";

export const ProductDashboardPage = () => {
	const { data, isLoading, error } = useProductDashboardData();
	const {
		data: matomoData,
		isLoading: isMatomoLoading,
		error: matomoError,
	} = useMatomoDashboardData();

	return (
		<Layout>
			<AdminSidebar>
				<div className="w-full max-w-screen-xl p-6 space-y-6">
					<h2 className="text-lg font-semibold">
						{Content["productDashboard.users.title"]}
					</h2>
					{isLoading &&
						Array.from({ length: 5 }).map((_, index) => (
							<Skeleton className="h-10" key={index} />
						))}
					{error && <p>{Content["productDashboard.error"]}</p>}
					{data && (
						<>
							<LineChartUserEvolution data={data.daily_user_evolution} />
							<MetricCardsActiveUsers
								dau={data.dau}
								wau={data.wau}
								mau={data.mau}
							/>
							<DomainsTable domains={data.domains} />
							<h2 className="text-lg font-semibold">
								{Content["productDashboard.chats.title"]}
							</h2>
							<MetricCardsChats data={data} />
						</>
					)}

					<h2 className="text-lg font-semibold">
						{Content["productDashboard.matomo.title"]}
					</h2>
					{isMatomoLoading && <Skeleton className="h-10" />}
					{matomoError && <p>{Content["productDashboard.matomo.error"]}</p>}
					{matomoData && !matomoData.available && (
						<p>{Content["productDashboard.matomo.unavailable"]}</p>
					)}
					{matomoData?.available && (
						<>
							<MetricCardsMatomo
								averageSessionDurationSeconds={
									matomoData.averageSessionDurationSeconds
								}
								previousAverageSessionDurationSeconds={
									matomoData.previousAverageSessionDurationSeconds
								}
								profilePageViews={matomoData.profilePageViews}
								previousProfilePageViews={matomoData.previousProfilePageViews}
							/>
							<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
								<AreaChartDeviceTrend data={matomoData.deviceMonthlyTrend} />
								<RadarChartBreakdown
									title={
										Content["productDashboard.matomo.browserBreakdown.title"]
									}
									description={
										Content[
											"productDashboard.matomo.browserBreakdown.description"
										]
									}
									seriesLabel={
										Content[
											"productDashboard.matomo.browserBreakdown.seriesLabel"
										]
									}
									color="hsl(var(--chart-2))"
									data={matomoData.browserBreakdown}
								/>
							</div>
							<BarChartBreakdown
								title={Content["productDashboard.matomo.osBreakdown.title"]}
								description={
									Content["productDashboard.matomo.osBreakdown.description"]
								}
								seriesLabel={
									Content["productDashboard.matomo.osBreakdown.seriesLabel"]
								}
								color="hsl(var(--chart-1))"
								data={matomoData.osBreakdown}
							/>
						</>
					)}
				</div>
			</AdminSidebar>
		</Layout>
	);
};
