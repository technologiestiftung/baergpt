export type DailyUsers = {
	date: string;
	total: number;
	new: number;
};

export type ProductDashboardStats = {
	daily_user_evolution: DailyUsers[];
	dau: number;
	wau: number;
	mau: number;
	domains: {
		count: number;
		domain: string;
	}[];
	total_chats: number;
	total_user_documents: number;
	average_inferences_per_user: number;
	total_messages_with_documents: number;
	total_messages_without_documents: number;
};

export type MatomoDeviceMonthlyTrendPoint = {
	month: string;
	desktop: number;
	mobile: number;
	tablet: number;
};

export type MatomoPercentageEntry = {
	label: string;
	percentage: number;
};

export type MatomoDashboardStats = {
	available: boolean;
	averageSessionDurationSeconds: number;
	profilePageViews: number;
	deviceMonthlyTrend: MatomoDeviceMonthlyTrendPoint[];
	osBreakdown: MatomoPercentageEntry[];
	browserBreakdown: MatomoPercentageEntry[];
};
