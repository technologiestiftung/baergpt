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
