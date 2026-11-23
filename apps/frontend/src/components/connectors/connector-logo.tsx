interface ConnectorLogoProps {
	src: string;
	alt?: string;
	/** Size and padding of the tile, e.g. "size-8 p-1.5" */
	className: string;
	/** Dialogs and the chat menu use a softer shadow than the lists */
	shadow?: "default" | "soft";
}

export function ConnectorLogo({
	src,
	alt = "",
	className,
	shadow = "default",
}: ConnectorLogoProps) {
	return (
		<div
			className={`shrink-0 flex items-center justify-center rounded-3px bg-white ${
				shadow === "soft"
					? "drop-shadow-[0px_0px_1.5px_rgba(36,61,100,0.3)]"
					: "drop-shadow-[0px_0px_2.4px_rgba(36,61,100,0.3)]"
			} ${className}`}
		>
			<img
				src={src}
				alt={alt}
				className="max-w-full max-h-full object-contain"
			/>
		</div>
	);
}
