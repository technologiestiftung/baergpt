export function Skeleton({ className }: { className: string }) {
	return (
		<div
			className={`
				relative 
				rounded-[3px]
				before:rounded-[3px]
				overflow-hidden
				before:bg-[length:200%_100%] before:animate-gradient-move
				before:absolute before:inset-0 before:rounded-inherit
				before:bg-[linear-gradient(90deg,_theme('colors.dunkelblau-90')_0%,_rgba(12,39,83,0.1)_63%,_theme('colors.dunkelblau-90')_100%)]
				w-full h-full`}
		>
			<div className={`bg-transparent ${className}`} />
		</div>
	);
}
