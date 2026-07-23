import type { OpenDataCitationSource } from "../../../../common.ts";
import Content from "../../../../content.ts";
import { OpenDataIcon } from "../../../primitives/icons/open-data-icon.tsx";

export function OpenDataCitationItem({
	source,
}: {
	source: OpenDataCitationSource;
}) {
	return (
		<a
			href={source.url}
			target="_blank"
			rel="noopener noreferrer"
			className="group flex flex-col items-start p-3.5 hover:bg-hellblau-30 text-dunkelblau-200 cursor-pointer gap-2.5"
		>
			<div className="flex items-center gap-1 text-xs">
				<OpenDataIcon />
				daten.berlin.de
			</div>
			<div className="flex min-w-0 text-sm font-bold truncate group-hover:underline">
				{source.title}
			</div>
			<div className="text-xs text-dunkelblau-40">
				{Content["chat.citationsDialog.openData.datasetLabel"]}
			</div>
		</a>
	);
}
