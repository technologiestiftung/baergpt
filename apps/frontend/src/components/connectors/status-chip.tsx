import Content from "../../content.ts";

export function StatusChip() {
	return (
		<div className="flex items-center gap-1 pl-1 pr-1.5 py-px rounded-full bg-mittelgruen/15 w-fit">
			<img src="/icons/green-check-icon.svg" alt="" width={14} height={14} />
			<span className="text-xs leading-4 font-normal text-mittelgruen">
				{Content["connectors.status.connected"]}
			</span>
		</div>
	);
}
