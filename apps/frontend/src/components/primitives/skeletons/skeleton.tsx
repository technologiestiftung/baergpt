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
				before:bg-[linear-gradient(90deg,_theme('colors.hellblau-60')_0%,_rgba(46,64,102,0.8)_40%,_transparent_49%,_transparent_51%,_rgba(46,64,102,0.8)_60%,_theme('colors.hellblau-60')_100%)]
				w-full h-full`}
		>
			<div className={`bg-transparent ${className}`} />
		</div>
	);
}
