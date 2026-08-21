import { useMemo } from "react";
import { DataGrid } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import Content from "../../content.ts";
import { useSpreadsheet } from "./hooks/use-spreadsheet.tsx";
import { getColumnCount } from "./get-column-count.ts";
import { buildColumns } from "./build-columns.ts";
import { buildGridRows } from "./build-grid-rows.ts";

/**
 * Read-only spreadsheet preview. Parses the already-downloaded file (reusing
 * the blob URL produced by `usePreviewDocumentStore`, so there is no second
 * download) and renders each sheet in a non-editable grid. Rendered inline in
 * the document preview area (where pdf/docx use an iframe).
 */
export function SpreadsheetPreview({ downloadUrl }: { downloadUrl: string }) {
	const {
		sheets,
		activeSheetIndex,
		setActiveSheetIndex,
		isLoading,
		truncated,
	} = useSpreadsheet(downloadUrl);

	const activeSheet = sheets[activeSheetIndex];
	const activeRows = activeSheet?.rows ?? [];

	const columnCount = useMemo(() => getColumnCount(activeRows), [activeRows]);
	const columns = useMemo(() => buildColumns(columnCount), [columnCount]);
	const rows = useMemo(
		() => buildGridRows(activeRows, columnCount),
		[activeRows, columnCount],
	);

	if (isLoading) {
		return (
			<p className="text-lg text-dunkelblau-80 pt-4">
				{Content["documentsPreviewSection.loadingPreview"]}
			</p>
		);
	}

	return (
		<div className="flex flex-col w-full h-full min-h-0 gap-2">
			{sheets.length > 1 && (
				<div className="flex gap-1 overflow-x-auto flex-shrink-0">
					{sheets.map((sheet, index) => (
						<button
							key={sheet.name}
							onClick={() => setActiveSheetIndex(index)}
							className={`px-2 py-1 text-sm rounded-3px whitespace-nowrap focus-visible:outline-default ${
								index === activeSheetIndex
									? "bg-hellblau-100 text-dunkelblau-100 font-semibold"
									: "hover:bg-hellblau-60 text-dunkelblau-80"
							}`}
						>
							{sheet.name}
						</button>
					))}
				</div>
			)}
			{truncated && (
				<p className="text-xs text-warning-100 flex-shrink-0">
					{Content["documentsPreviewSection.spreadsheet.truncated"]}
				</p>
			)}
			{!activeSheet || rows.length === 0 ? (
				<p className="text-lg text-dunkelblau-80 pt-4">
					{Content["documentsPreviewSection.spreadsheet.empty"]}
				</p>
			) : (
				<div className="flex-1 min-h-0 shadow-md bg-white">
					<DataGrid
						columns={columns}
						rows={rows}
						rowKeyGetter={(row) => row.__id__}
						className="rdg-light h-full"
						style={{ height: "100%" }}
					/>
				</div>
			)}
		</div>
	);
}
