import { Layout } from "@/components/layout/layout.tsx";
import { AdminSidebar } from "@/components/admin-sidebar/admin-sidebar.tsx";
import { LineChartUserEvolution } from "@/components/charts/line-chart-user-evolution.tsx";
import { MetricCardsActiveUsers } from "@/components/charts/metric-cards-active-users.tsx";
import { DomainsTable } from "@/components/charts/domains-table.tsx";
import { useProductDashboardData } from "@/hooks/use-product-dashboard-data.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import Content from "@/content.ts";
import { MetricCardsChats } from "@/components/charts/metric-cards-chats.tsx";

export const ProductDashboardPage = () => {
	const { data, isLoading, error } = useProductDashboardData();

	return (
		<Layout>
			<AdminSidebar>
				<div className="w-full max-w-screen-xl p-6 space-y-6">
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
							<MetricCardsChats data={data} />
						</>
					)}
				</div>
			</AdminSidebar>
		</Layout>
	);
};
