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
	previousAverageSessionDurationSeconds: number | null;
	profilePageViews: number;
	previousProfilePageViews: number | null;
	deviceMonthlyTrend: MatomoDeviceMonthlyTrendPoint[];
	osBreakdown: MatomoPercentageEntry[];
	browserBreakdown: MatomoPercentageEntry[];
};
