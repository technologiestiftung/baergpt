import Content from "../../../../content";

export function PublicDocumentPill() {
	return (
		<div
			className="bg-hellblau-50 text-dunkelblau-200 w-fit text-xs leading-4 font-normal flex flex-row items-center gap-0.5 px-[5px] rounded-full"
			data-testid="public-document-pill"
		>
			<img src="/icons/baer-icon-white.svg" alt="baer-icon-white" />
			{Content["chat.publicDocumentPill.label"]}
		</div>
	);
}
