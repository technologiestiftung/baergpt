import React from "react";
import { BucketIcon } from "../../../primitives/icons/bucket-icon";
import { Chat } from "../../../../common";
import Content from "../../../../content";
import { showDeleteHistoryEntryDialog } from "./delete-history-entry-dialog";
import { useHistoryEntryDeleteStore } from "../../../../store/use-history-entry-delete-store";

interface DeleteHistoryEntryButtonProps {
	chat: Chat;
	isVisible: boolean;
	onFocus?: () => void;
	onBlur?: () => void;
}

export const DeleteHistoryEntryButton: React.FC<
	DeleteHistoryEntryButtonProps
> = ({ chat, isVisible, onFocus, onBlur }) => {
	const { setHistoryEntryToDeleteId, setHistoryEntryToDeleteName } =
		useHistoryEntryDeleteStore();
	return (
		<>
			<button
				type="button"
				aria-label={Content["deleteHistoryEntryButton.arialabel"]}
				className="rounded-3px w-fit focus-visible:outline-default transition-opacity duration-200"
				onClick={() => {
					showDeleteHistoryEntryDialog();
					setHistoryEntryToDeleteId(chat.id);
					setHistoryEntryToDeleteName(chat.name.replace(/[#`>*]/g, ""));
				}}
				onFocus={onFocus}
				onBlur={onBlur}
			>
				<div className="block md:hidden">
					<BucketIcon disabled />
				</div>

				{isVisible && (
					<div className="hidden md:block">
						<BucketIcon isLight={true} />
					</div>
				)}
			</button>
		</>
	);
};
