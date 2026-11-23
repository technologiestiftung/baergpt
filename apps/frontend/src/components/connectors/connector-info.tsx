import { ConnectorLogo } from "./connector-logo.tsx";

interface ConnectorInfoProps {
	logo: string;
	logoAlt: string;
	name: string;
	description: string;
}

export function ConnectorInfo({
	logo,
	logoAlt,
	name,
	description,
}: ConnectorInfoProps) {
	return (
		<div className="flex gap-3 items-center w-[285px]">
			<ConnectorLogo src={logo} alt={logoAlt} className="size-8 p-1.5" />
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
