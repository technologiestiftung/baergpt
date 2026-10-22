import type { ReactNode } from "react";
import Content from "../../content.ts";
import type { Integration } from "../../api/integrations/get-integrations.ts";
import { showDatawrapperConnectDialog } from "./datawrapper-connect-dialog.tsx";
import { DatawrapperMenuButton } from "./datawrapper-menu-button.tsx";
import { StatusChip } from "./status-chip.tsx";
import {
	builtInConnectors,
	datawrapperConnector,
} from "./connectors.ts";
import { formatMaskedToken } from "./format-masked-token.ts";

export function ConnectorsListMobile({
	datawrapperIntegration,
}: {
	datawrapperIntegration?: Integration;
}) {
	return (
		<ul className="flex md:hidden flex-col border-t-[0.5px] border-dunkelblau-30">
			{builtInConnectors
				.filter((connector) => connector.isEnabled)
				.map((connector) => (
					<MobileConnectorRow
						key={connector.id}
						logo={connector.logo}
						logoAlt={connector.logoAlt}
						name={connector.name}
						meta={Content["connectors.providedByBaergpt"]}
						trailing={
							<>
								<StatusChip />
								<div className="shrink-0 size-8" />
							</>
						}
					/>
				))}

			{datawrapperConnector.isEnabled && (
				<MobileConnectorRow
					logo={datawrapperConnector.logo}
					logoAlt={datawrapperConnector.logoAlt}
					name={datawrapperConnector.name}
					meta={
						datawrapperIntegration && (
							<>
								<img
									src="/icons/key-icon.svg"
									alt={Content["connectors.datawrapper.tokenIcon.alt"]}
									width={14}
									height={14}
								/>
								{formatMaskedToken(datawrapperIntegration.last4)}
							</>
						)
					}
					trailing={
						datawrapperIntegration ? (
							<>
								<StatusChip />
								<DatawrapperMenuButton />
							</>
						) : (
							<button
								type="button"
								onClick={showDatawrapperConnectDialog}
								className="flex items-center justify-center gap-1.5 h-8 min-w-[120px] pl-[18px] pr-3 rounded-3px border border-dunkelblau-100 bg-white text-sm leading-5 font-normal text-dunkelblau-100 hover:bg-hellblau-50 focus-visible:outline-default"
							>
								{Content["connectors.datawrapper.connectButton"]}
								<img
									src="/icons/plus-dark-blue-icon.svg"
									alt=""
									width={16}
									height={16}
								/>
							</button>
						)
					}
				/>
			)}
		</ul>
	);
}

function MobileConnectorRow({
	logo,
	logoAlt,
	name,
	meta,
	trailing,
}: {
	logo: string;
	logoAlt: string;
	name: string;
	meta?: ReactNode;
	trailing: ReactNode;
}) {
	return (
		<li className="flex gap-3 items-center min-h-[74px] py-4 border-b-[0.5px] border-dunkelblau-30">
			<div className="shrink-0 size-7 rounded-3px bg-white drop-shadow-[0px_0px_2.4px_rgba(36,61,100,0.3)] flex items-center justify-center p-1.5">
				<img
					src={logo}
					alt={logoAlt}
					className="max-w-full max-h-full object-contain"
				/>
			</div>
			<div className="flex flex-col gap-0.5 flex-1 min-w-0">
				<span className="text-base leading-6 font-bold text-dunkelblau-100">
					{name}
				</span>
				{meta && (
					<span className="flex items-center gap-1 text-xs leading-4 font-normal text-dunkelblau-65">
						{meta}
					</span>
				)}
			</div>
			<div className="flex gap-1 items-center shrink-0">{trailing}</div>
		</li>
	);
}
