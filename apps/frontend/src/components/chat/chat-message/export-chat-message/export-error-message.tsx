import React from "react";
import Content from "../../../../content.ts";

export const ExportErrorMessage: React.FC<{ message: string }> = ({
	message,
}) => (
	<div className="flex rounded-3px items-center gap-1 pl-[6px] p-[5px] bg-red-100">
		<img
			src="/icons/error-icon.svg"
			width={16}
			height={16}
			alt={Content["downloadIcon.imgAlt"]}
		/>
		<span className="text-sm leading-5 font-normal text-warning-100">
			{message}
		</span>
	</div>
);
