import React from "react";
import Content from "../../../content";
import { ChatButton } from "../../primitives/buttons/chat-button";
import {
	openCitationsDialog,
	CitationsDialog,
} from "./chat-citations/citations-dialog.tsx";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";
import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";
import { useCitationsStore } from "../../../store/use-citations-store.ts";
import type { CitationWithDetails } from "../../../common.ts";

interface CitationsButtonProps {
	messageId: number;
	citations: number[] | null;
	isLastMessage: boolean;
}

export const CitationsButton: React.FC<CitationsButtonProps> = ({
	messageId,
	citations,
	isLastMessage,
}) => {
	const { status } = useInferenceLoadingStatusStore();
	const isLoadingCitations = status === "loading-citations";
	const isLoadingLastCitations = isLastMessage && isLoadingCitations;

	const { getCitation } = useCitationsStore();
	const hasCitations =
		citations &&
		citations.length > 0 &&
		checkCitationsExists(citations, getCitation);

	const isCitationsButtonVisible = hasCitations || isLoadingLastCitations;

	if (!isCitationsButtonVisible) {
		return null;
	}

	const loadingSpinnerVariant = isLoadingLastCitations ? "disabled" : "default";

	return (
		<>
			<ChatButton
				aria-label={Content["chat.citationsButton.ariaLabel"]}
				disabled={isLoadingLastCitations}
				onClick={openCitationsDialog(messageId)}
			>
				{isLoadingLastCitations && (
					<>
						<LoadingSpinnerIcon variant={loadingSpinnerVariant} />
						<span className="hidden sm:flex">
							{Content["chat.citationsButton.loadingLabel"]}
						</span>
					</>
				)}

				{!isLoadingLastCitations && (
					<>
						<img
							src="/icons/citations-icon.svg"
							width={20}
							height={20}
							alt=""
						/>
						<span className="hidden sm:flex">
							{Content["chat.citationsButton.label"]}
						</span>
					</>
				)}
			</ChatButton>
			<CitationsDialog messageId={messageId} citations={citations} />
		</>
	);
};

function checkCitationsExists(
	citations: number[] | null,
	getCitation: (id: number) => CitationWithDetails | undefined,
): boolean {
	if (!citations) {
		return false;
	}

	// Check if any of the citation IDs exist in the citation store.
	return citations.some((id) => getCitation(id));
}
