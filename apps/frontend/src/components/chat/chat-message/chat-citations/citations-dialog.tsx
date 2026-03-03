import React from "react";
import { Content } from "../../../../content";
import { DefaultDialog } from "../../../primitives/dialogs/default-dialog.tsx";
import { CitationItem } from "./citation-item.tsx";
import { useCitationsStore } from "../../../../store/use-citations-store.ts";

interface CitationsDialogProps {
	messageId: number | null;
	citations: number[] | null;
}

export const citationsDialogId = "citations-dialog";

export function openCitationsDialog(messageId: number) {
	return () =>
		(
			document.getElementById(
				`${citationsDialogId}-${messageId}`,
			) as HTMLDialogElement
		).showModal();
}

export function closeCitationsDialog(messageId: number) {
	return () =>
		(
			document.getElementById(
				`${citationsDialogId}-${messageId}`,
			) as HTMLDialogElement
		).close();
}

export const CitationsDialog: React.FC<CitationsDialogProps> = ({
	messageId,
	citations,
}) => {
	const { getCitations } = useCitationsStore();

	if (!messageId || !citations) {
		return null;
	}

	const allCitationDetails = citations.flatMap((citationId) =>
		getCitations(citationId),
	);

	return (
		<DefaultDialog id={`${citationsDialogId}-${messageId}`}>
			<div className="bg-white rounded-lg w-full md:w-[600px] max-h-[650px] max-w-[90vw] flex flex-col">
				<div className="sticky top-0 bg-white flex flex-row items-center justify-between py-3 pl-[30px] pr-[23px] border-b-[0.5px] border-dunkelblau-50 rounded-t-lg">
					<h2 className="text-dunkelblau-200 text-2xl leading-8 font-semibold">
						{Content["chat.citationsDialog.title"]}
					</h2>
					<button
						className="size-7 p-1 rounded-3px focus-visible:outline-default hover:bg-hellblau-50 flex items-center justify-center"
						onClick={closeCitationsDialog(messageId)}
						data-testid={`close-citations-dialog-button-${messageId}`}
					>
						<img
							src="/icons/close-dialog-icon.svg"
							alt={Content["closeIcon.imgAlt"]}
						/>
					</button>
				</div>
				<div className="flex flex-col px-4 pb-4 overflow-y-auto">
					{allCitationDetails.map((citation, index) => (
						<CitationItem citation={citation} key={index} />
					))}
				</div>
			</div>
		</DefaultDialog>
	);
};
