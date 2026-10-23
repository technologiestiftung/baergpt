import { useId, useRef, useState } from "react";
import Content from "../../content.ts";
import { BottomSheet } from "../primitives/bottom-sheet/bottom-sheet.tsx";
import { ConnectorLogo } from "./connector-logo.tsx";
import { showDatawrapperConnectDialog } from "./datawrapper-connect-dialog.tsx";
import { showDatawrapperDisconnectDialog } from "./datawrapper-disconnect-dialog.tsx";

export function DatawrapperMenuButton() {
	const [isOpen, setIsOpen] = useState(false);
	const titleId = useId();
	const pendingActionRef = useRef<(() => void) | null>(null);

	const closeSheet = () => setIsOpen(false);

	const handleSheetClose = () => {
		closeSheet();
		const pendingAction = pendingActionRef.current;
		pendingActionRef.current = null;
		pendingAction?.();
	};

	const menuItems = [
		{
			label: Content["connectors.datawrapper.menu.edit"],
			icon: "/icons/edit-icon.svg",
			action: showDatawrapperConnectDialog,
		},
		{
			label: Content["connectors.datawrapper.menu.disconnect"],
			icon: "/icons/bucket-dark-blue-icon.svg",
			action: showDatawrapperDisconnectDialog,
		},
	];

	const handleItemClick = (item: (typeof menuItems)[number]) => {
		pendingActionRef.current = item.action;
		closeSheet();
	};

	return (
		<>
			<button
				type="button"
				aria-label={Content["connectors.datawrapper.menuButton.ariaLabel"]}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
				onClick={() => setIsOpen(true)}
				className="flex items-center justify-center size-8 rounded-3px hover:bg-hellblau-60 focus-visible:outline-default"
			>
				<img
					src="/icons/dot-menu-icon-blue.svg"
					alt=""
					width={22}
					height={22}
				/>
			</button>

			<BottomSheet
				isOpen={isOpen}
				onClose={handleSheetClose}
				ariaLabelledBy={titleId}
			>
				<div className="flex items-center justify-between gap-3 px-3 pb-3 border-b-[0.5px] border-dunkelblau-30">
					<div className="flex items-center gap-5 min-w-0">
						<ConnectorLogo
							src="/icons/datawrapper-icon.svg"
							className="size-5 p-1"
						/>
						<h2 id={titleId} className="text-base leading-6 font-bold truncate">
							{Content["connectors.datawrapper.sheet.title"]}
						</h2>
					</div>
					<button
						type="button"
						aria-label={Content["connectors.datawrapper.sheet.close.ariaLabel"]}
						onClick={closeSheet}
						className="shrink-0 flex items-center justify-center size-6 rounded-3px focus-visible:outline-default"
					>
						<img
							src="/icons/dark-blue-x-icon.svg"
							alt=""
							width={18}
							height={18}
						/>
					</button>
				</div>

				<ul className="flex flex-col px-3">
					{menuItems.map((item) => (
						<li key={item.label}>
							<button
								type="button"
								onClick={() => handleItemClick(item)}
								className="flex items-center gap-5 w-full h-12 text-left text-base leading-6 font-normal focus-visible:outline-default rounded-3px"
							>
								<span className="flex items-center justify-center shrink-0 size-5">
									<img
										src={item.icon}
										alt=""
										width={32}
										height={32}
										className="max-w-none"
									/>
								</span>
								{item.label}
							</button>
						</li>
					))}
				</ul>
			</BottomSheet>
		</>
	);
}
