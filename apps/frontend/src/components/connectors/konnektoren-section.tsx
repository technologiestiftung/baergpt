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

export const KonnektorenSection = () => {
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

			<div className="flex flex-col overflow-x-auto">
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

				<div className="flex flex-col border-t border-dunkelblau-30">
					{config.featureFlagMcpParlaAllowed && (
						<div className="flex gap-4 items-center px-2 py-3 border-b border-dunkelblau-30 min-w-fit">
							<KonnektorInfo
								logo="/icons/parla-logo-icon.svg"
								logoAlt=""
								name={Content["connectors.parla.name"]}
								description={Content["connectors.parla.description"]}
							/>
							<div className="w-[110px]">
								<StatusChip />
							</div>
							<span className="flex-1 text-xs leading-4 font-normal text-dunkelblau-65">
								{Content["connectors.providedByBaergpt"]}
							</span>
						</div>
					)}

					{config.featureFlagMcpOpenDataAllowed && (
						<div className="flex gap-4 items-center px-2 py-3 border-b border-dunkelblau-30 min-w-fit">
							<KonnektorInfo
								logo="/icons/berlin-open-data-logo-icon.svg"
								logoAlt=""
								name={Content["connectors.openData.name"]}
								description={Content["connectors.openData.description"]}
							/>
							<div className="w-[110px]">
								<StatusChip />
							</div>
							<span className="flex-1 text-xs leading-4 font-normal text-dunkelblau-65">
								{Content["connectors.providedByBaergpt"]}
							</span>
						</div>
					)}

					{config.featureFlagMcpDatawrapperAllowed && (
						<div className="flex gap-4 items-center px-2 py-3 border-b border-dunkelblau-30 min-w-fit">
							<KonnektorInfo
								logo="/icons/datawrapper-icon.svg"
								logoAlt=""
								name={Content["connectors.datawrapper.name"]}
								description={Content["connectors.datawrapper.description"]}
							/>
							<div className="w-[110px]">
								{datawrapperIntegration && <StatusChip />}
							</div>
							<span className="flex-1 text-xs leading-4 font-normal text-dunkelblau-65">
								{datawrapperIntegration &&
									`${"•".repeat(16)}${datawrapperIntegration.last4}`}
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
									<button
										type="button"
										onClick={showDatawrapperConnectDialog}
										className="flex items-center gap-1.5 h-8 px-3 rounded-3px border border-dunkelblau-100 bg-white text-sm leading-5 font-normal text-dunkelblau-100 hover:bg-hellblau-50 focus-visible:outline-default"
									>
										<img
											src="/icons/plus-dark-blue-icon.svg"
											alt=""
											width={16}
											height={16}
										/>
										{Content["connectors.datawrapper.connectButton"]}
									</button>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

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
};

function StatusChip() {
	return (
		<div className="flex items-center gap-1 pl-1 pr-1.5 py-px rounded-full bg-mittelgruen/15 w-fit">
			<img src="/icons/green-check-icon.svg" alt="" width={14} height={14} />
			<span className="text-xs leading-4 font-normal text-mittelgruen">
				{Content["connectors.status.connected"]}
			</span>
		</div>
	);
}

function KonnektorInfo({
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
