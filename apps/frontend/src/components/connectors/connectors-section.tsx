import { useEffect } from "react";
import Content from "../../content.ts";
import { config } from "../../config.ts";
import { useIntegrationsStore } from "../../store/use-integrations-store.ts";
import {
	DatawrapperConnectDialog,
	showDatawrapperConnectDialog,
} from "./datawrapper-connect-dialog.tsx";
import {
	DatawrapperDisconnectDialog,
	showDatawrapperDisconnectDialog,
} from "./datawrapper-disconnect-dialog.tsx";
import { ConnectorsListMobile } from "./connectors-list-mobile.tsx";
import { StatusChip } from "./status-chip.tsx";
import { ConnectorInfo } from "./connector-info.tsx";
import { builtInConnectors, datawrapperConnector } from "./connectors.ts";
import { formatMaskedToken } from "./format-masked-token.ts";
import { DatawrapperConnectButton } from "./datawrapper-connect-button.tsx";

export function ConnectorsSection() {
	const datawrapperIntegration = useIntegrationsStore((state) =>
		state.getIntegration("datawrapper"),
	);

	useEffect(() => {
		if (config.featureFlagMcpDatawrapperAllowed) {
			useIntegrationsStore.getState().fetchIntegrations();
		}
	}, []);

	return (
		<div className="flex flex-col gap-2">
			<h3 className="text-base leading-6 font-semibold">
				{Content["connectors.heading"]}
			</h3>
			<div className="flex flex-col max-w-[400px] mb-2">
				<p className="text-base leading-6 font-normal">
					{Content["connectors.intro"]}
				</p>
				<a
					href={Content["connectors.introLink.href"]}
					target="_blank"
					rel="noopener noreferrer"
					className="text-sm leading-5 font-normal text-aktiv-blau-100 underline w-fit"
				>
					{Content["connectors.introLink"]}
				</a>
			</div>

			<div className="hidden md:flex flex-col overflow-x-auto">
				<div className="flex gap-4 items-center pb-2 px-2 min-w-fit">
					<span className="w-[285px] text-xs leading-4 font-normal text-dunkelblau-65">
						{Content["connectors.table.header.connector"]}
					</span>
					<span className="w-[110px] text-xs leading-4 font-normal text-dunkelblau-65">
						{Content["connectors.table.header.status"]}
					</span>
					<span className="flex-1 text-xs leading-4 font-normal text-dunkelblau-65">
						{Content["connectors.table.header.token"]}
					</span>
				</div>

				<div className="flex flex-col border-t-[0.5px] border-dunkelblau-30">
					{builtInConnectors
						.filter((connector) => connector.isEnabled)
						.map((connector) => (
							<div
								key={connector.id}
								className="flex gap-4 items-center px-2 py-3 border-b-[0.5px] border-dunkelblau-30 min-w-fit"
							>
								<ConnectorInfo
									logo={connector.logo}
									logoAlt={connector.logoAlt}
									name={connector.name}
									description={connector.description}
								/>
								<div className="w-[110px]">
									<StatusChip />
								</div>
								<span className="flex-1 text-xs leading-4 font-normal text-dunkelblau-65">
									{Content["connectors.providedByBaergpt"]}
								</span>
							</div>
						))}

					{datawrapperConnector.isEnabled && (
						<div className="flex gap-4 items-center px-2 py-3 border-b-[0.5px] border-dunkelblau-30 min-w-fit">
							<ConnectorInfo
								logo={datawrapperConnector.logo}
								logoAlt={datawrapperConnector.logoAlt}
								name={datawrapperConnector.name}
								description={datawrapperConnector.description}
							/>
							<div className="w-[110px]">
								{datawrapperIntegration && <StatusChip />}
							</div>
							<span className="flex-1 text-xs leading-4 font-normal text-dunkelblau-65">
								{datawrapperIntegration &&
									formatMaskedToken(datawrapperIntegration.last4)}
							</span>
							<div className="flex items-center shrink-0">
								{datawrapperIntegration ? (
									<>
										<button
											type="button"
											aria-label={
												Content["connectors.datawrapper.editButton.ariaLabel"]
											}
											onClick={showDatawrapperConnectDialog}
											className="flex items-center justify-center size-8 rounded-3px hover:bg-hellblau-60 focus-visible:outline-default"
										>
											<img
												src="/icons/edit-icon.svg"
												alt=""
												width={32}
												height={32}
											/>
										</button>
										<button
											type="button"
											aria-label={
												Content["connectors.datawrapper.deleteButton.ariaLabel"]
											}
											onClick={showDatawrapperDisconnectDialog}
											className="flex items-center justify-center size-8 rounded-3px hover:bg-hellblau-60 focus-visible:outline-default"
										>
											<img
												src="/icons/bucket-dark-blue-icon.svg"
												alt=""
												width={32}
												height={32}
											/>
										</button>
									</>
								) : (
									<DatawrapperConnectButton
										iconPosition="leading"
										className="px-3"
									/>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			<ConnectorsListMobile datawrapperIntegration={datawrapperIntegration} />

			{config.featureFlagMcpDatawrapperAllowed && (
				<>
					<DatawrapperConnectDialog
						mode={datawrapperIntegration ? "replace" : "connect"}
						integration={datawrapperIntegration}
					/>
					<DatawrapperDisconnectDialog />
				</>
			)}
		</div>
	);
}
