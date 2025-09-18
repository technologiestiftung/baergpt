import React from "react";

export const markdownWrapperScrollableTable = {
	table: (props: React.TableHTMLAttributes<HTMLTableElement>) => (
		<div className="table-wrapper">
			<table {...props} />
		</div>
	),
};
