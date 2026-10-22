export function ConnectorInfo({
	logo,
	logoAlt,
	name,
	description,
}: {
	logo: string;
	logoAlt: string;
	name: string;
	description: string;
}) {
	return (
		<div className="flex gap-3 items-center w-[285px]">
			<div className="shrink-0 size-8 rounded-3px bg-white drop-shadow-[0px_0px_2.4px_rgba(36,61,100,0.3)] flex items-center justify-center p-1.5">
				<img
					src={logo}
					alt={logoAlt}
					className="max-w-full max-h-full object-contain"
				/>
			</div>
			<div className="flex flex-col max-w-[225px]">
				<span className="text-base leading-6 font-bold text-dunkelblau-100">
					{name}
				</span>
				<span className="text-xs leading-4 font-normal text-dunkelblau-65">
					{description}
				</span>
			</div>
		</div>
	);
}
