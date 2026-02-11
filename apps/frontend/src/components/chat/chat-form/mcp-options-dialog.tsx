import React from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import Content from "../../../content";
import { CloseIcon } from "../../primitives/icons/close-icon";
import { useChatsStore } from "../../../store/use-chats-store";
import type { McpOptions } from "../../../common";

const mcpOptionsDialogId = "mcp-options-dialog";

export function showMcpOptionsDialog() {
	(
		document.getElementById(`${mcpOptionsDialogId}`) as HTMLDialogElement
	).showModal();
}

export function hideMcpOptionsDialog() {
	(
		document.getElementById(`${mcpOptionsDialogId}`) as HTMLDialogElement
	).close();
}

export const MCP_OPTIONS_VALUES: Record<string, McpOptions> = {
	parla: "parla",
};

export const McpOptionsDialog: React.FC = () => {
	const { selectedChatOptions, toggleChatOption } = useChatsStore();

	const mcpOptionsItems = [
		{
			label: Content["mcp.options.dialog.option1.label"],
			value: MCP_OPTIONS_VALUES.parla,
			description: Content["mcp.options.dialog.option1.description"],
			ariaLabel: Content["mcp.options.dialog.option1.ariaLabel"],
			logo: "/icons/parla-logo-icon.svg",
		},
	];

	return (
		<DefaultDialog
			id={mcpOptionsDialogId}
			className="w-full md:w-[29rem] pt-4 border border-hellblau-50"
		>
			<div className="flex flex-col justify-between items-center rounded-[3px] ">
				<div className="w-full flex justify-between items-center pb-4 pl-4 pr-3 border-b border-hellblau-50">
					<h3 className="text-lg leading-7 text-dunkelblau-80">
						{Content["mcp.options.dialog.title"]}
					</h3>
					<button
						type="button"
						className="size-7 p-1 rounded-3px focus-visible:outline-default hover:bg-hellblau-50 flex items-center justify-center"
						onClick={hideMcpOptionsDialog}
					>
						<CloseIcon variant="darkBlue" />
					</button>
				</div>

				<ul className="flex flex-col w-full">
					{mcpOptionsItems.map((item) => {
						const isSelected = selectedChatOptions.includes(item.value);
						return (
							<li key={item.value}>
								<button
									type="button"
									className="flex items-center justify-between w-full py-3 px-4 hover:bg-hellblau-30 focus-visible:outline-2px rounded-3px"
									onClick={() => toggleChatOption(item.value)}
								>
									<div className="flex gap-x-3">
										<img src={item.logo} alt="" width={20} height={20} />
										<div className="flex flex-col text-start">
											<div
												className={`${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"}`}
											>
												{item.label}
											</div>
											<p className="text-xs leading-5 text-dunkelblau-50">
												{item.description}
											</p>
										</div>
									</div>
									<img
										src="/icons/check-active-icon.svg"
										alt={Content["chat.options.selected.icon.imgAlt"]}
										width={20}
										height={20}
										className={`${isSelected ? "block" : "hidden"}`}
									/>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		</DefaultDialog>
	);
};
