import React from "react";
import type { ExtraProps } from "react-markdown";

export type MarkdownTableProps = React.ComponentProps<"table"> & ExtraProps;

export function MarkdownWrapperScrollableTable({
	node: _node,
	...props
}: MarkdownTableProps) {
	return (
		<div className="table-wrapper">
			<table {...props} />
		</div>
	);
}
