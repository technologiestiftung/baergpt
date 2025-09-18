import React from "react";

export const ClockLoaderIcon: React.FC = () => {
	const size = 20;
	const color = "#9DA8BA"; // dunkelblau-40
	const durationMs = 1000;
	const cx = size / 2;
	const cy = size / 2;
	const r = size / 2 - 2;

	// Animated wedge path (3° steps — 120 segments)
	const steps = 120; // 3° increments
	const mkD = (angle: number) => {
		// avoid 360 exactly to prevent flickering
		const a = Math.min(angle, 359.999);
		const rad = (a - 90) * (Math.PI / 180);
		const x = cx + r * Math.cos(rad);
		const y = cy + r * Math.sin(rad);
		const largeArc = a > 180 ? 1 : 0;
		return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y} Z`;
	};

	const values = Array.from({ length: steps + 1 }, (_, i) =>
		mkD((i * 360) / steps),
	).join(";");

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			aria-hidden="true"
		>
			{/* outer circle */}
			<circle
				cx={cx}
				cy={cy}
				r={r}
				stroke={color}
				strokeWidth="2"
				fill="none"
			/>
			{/* animated wedge */}
			<path fill={color}>
				<animate
					attributeName="d"
					dur={`${durationMs}ms`}
					repeatCount="indefinite"
					values={values}
				/>
			</path>
		</svg>
	);
};
