import { createContext, useContext, useRef } from "react";
import {
	MarkdownWrapperScrollableTable,
	type MarkdownTableProps,
} from "./markdown-wrapper-scrollable-table.tsx";
import { TableExportButton } from "./table-export/table-export-button.tsx";

// A context instead of swapping the table component, which would remount
// every table (and reset its scroll position) once streaming ends
export const TableExportVisibleContext = createContext(true);

export function MarkdownExportableTable(props: MarkdownTableProps) {
	const tableRef = useRef<HTMLTableElement>(null);
	const isExportVisible = useContext(TableExportVisibleContext);

	return (
		<div className="flex flex-col">
			<MarkdownWrapperScrollableTable ref={tableRef} {...props} />
			{isExportVisible && <TableExportButton tableRef={tableRef} />}
		</div>
	);
}
