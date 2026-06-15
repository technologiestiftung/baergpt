import React from "react";

export function MarkdownWrapperScrollableTable(
	props: React.TableHTMLAttributes<HTMLTableElement>,
) {
	return (
		<div className="table-wrapper">
			<table {...props} />
		</div>
	);
}
