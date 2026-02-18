import Content from "../../../../content";

export function ParlaDocumentPill() {
	return (
		<div
			className="bg-hellblau-50 text-dunkelblau-200 w-fit text-xs leading-4 font-normal flex flex-row items-center gap-0.5 px-[5px] rounded-full whitespace-nowrap"
			data-testid="parla-document-pill"
		>
			<img
				src="/icons/parla-logo-icon.svg"
				alt="parla-logo-icon"
				className="w-2.5 shrink-0"
			/>
			{Content["chat.parlaDocumentPill.label"]}
		</div>
	);
}
