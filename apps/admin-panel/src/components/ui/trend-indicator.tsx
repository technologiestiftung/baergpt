import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const FLAT_THRESHOLD_PERCENT = 1;

type TrendDirection = "up" | "down" | "flat";

function getTrendDirection(changePercent: number): TrendDirection {
	if (Math.abs(changePercent) < FLAT_THRESHOLD_PERCENT) {
		return "flat";
	}
	return changePercent > 0 ? "up" : "down";
}

const TREND_ICONS: Record<TrendDirection, typeof TrendingUp> = {
	up: TrendingUp,
	down: TrendingDown,
	flat: Minus,
};

type TrendIndicatorProps = {
	current: number;
	previous: number | null;
	className?: string;
};

export function TrendIndicator({
	current,
	previous,
	className,
}: TrendIndicatorProps) {
	if (previous === null || previous === 0) {
		return null;
	}

	const changePercent = ((current - previous) / previous) * 100;
	const direction = getTrendDirection(changePercent);
	const Icon = TREND_ICONS[direction];

	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 text-base",
				direction === "up" && "text-green-500",
				direction === "down" && "text-red-500",
				direction === "flat" && "text-muted-foreground",
				className,
			)}
		>
			<Icon className="size-4" />
			{changePercent.toLocaleString("de-DE", {
				signDisplay: "exceptZero",
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
			})}
			%
		</span>
	);
}
