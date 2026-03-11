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
};
