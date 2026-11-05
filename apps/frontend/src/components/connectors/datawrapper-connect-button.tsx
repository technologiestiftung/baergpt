import Content from "../../content.ts";
import { showDatawrapperConnectDialog } from "./datawrapper-connect-dialog.tsx";

interface DatawrapperConnectButtonProps {
	iconPosition: "leading" | "trailing";
	className?: string;
}

export function DatawrapperConnectButton({
	iconPosition,
	className = "",
}: DatawrapperConnectButtonProps) {
	const plusIcon = (
		<img src="/icons/plus-dark-blue-icon.svg" alt="" width={16} height={16} />
	);

	return (
		<button
			type="button"
			onClick={showDatawrapperConnectDialog}
			className={`flex items-center justify-center gap-1.5 h-8 rounded-3px border border-dunkelblau-100 bg-white text-sm leading-5 font-normal text-dunkelblau-100 hover:bg-hellblau-50 focus-visible:outline-default ${className}`}
		>
			{iconPosition === "leading" && plusIcon}
			{Content["connectors.datawrapper.connectButton"]}
			{iconPosition === "trailing" && plusIcon}
		</button>
	);
}
