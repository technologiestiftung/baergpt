interface CodeSandboxIconProps {
	size?: number;
	variant?: "default" | "active";
}

export function CodeSandboxIcon({
	size = 14,
	variant = "default",
}: CodeSandboxIconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={
				variant === "active" ? "text-aktiv-blau-100" : "text-dunkelblau-100"
			}
		>
			<rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
			<path d="M6 8l2.5 2L6 12M10.5 12.5H14" />
		</svg>
	);
}
