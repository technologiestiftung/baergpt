import { useRef } from "react";
import {
	MarkdownWrapperScrollableTable,
	type MarkdownTableProps,
} from "./markdown-wrapper-scrollable-table.tsx";
import { TableExportButton } from "./table-export/table-export-button.tsx";

export function MarkdownExportableTable(props: MarkdownTableProps) {
	const tableRef = useRef<HTMLTableElement>(null);

	return (
		<div className="flex flex-col">
			<MarkdownWrapperScrollableTable ref={tableRef} {...props} />
			<TableExportButton tableRef={tableRef} />
		</div>
	);
}
