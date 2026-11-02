import React from "react";

interface ExportButtonProps {
	label: string;
	ariaLabel?: string;
	iconSrc?: string;
	onClick: () => void;
	autoFocus?: boolean;
	testId?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
	label,
	ariaLabel,
	iconSrc,
	onClick,
	autoFocus,
	testId,
}) => (
	<button
		autoFocus={autoFocus}
		className="flex w-full items-center gap-2 px-3 py-1.5 first:rounded-t-[3px] last:rounded-b-[3px] hover:bg-hellblau-50 focus-visible:outline-default"
		aria-label={ariaLabel}
		onClick={onClick}
		data-testid={testId}
	>
		{iconSrc && <img src={iconSrc} alt="" className="size-5" />}
		{label}
	</button>
);
