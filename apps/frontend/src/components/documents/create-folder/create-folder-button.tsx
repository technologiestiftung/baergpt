import React from "react";
import { showCreateFolderDialog } from "./create-folder-dialog";
import { useCurrentFolderStore } from "../../../store/use-current-folder-store.ts";
import { SecondaryButton } from "../../primitives/buttons/secondary-button.tsx";
import Content from "../../../content.ts";
import { FolderIcon } from "../../primitives/icons/folder-icon.tsx";

export const CreateFolderButton: React.FC = () => {
	const { currentFolder } = useCurrentFolderStore();

	if (currentFolder) {
		return null;
	}

	return (
		<>
			<SecondaryButton
				onClick={showCreateFolderDialog}
				disabled={currentFolder !== null}
			>
				<FolderIcon variant="new" />
				<span className="whitespace-nowrap">
					{Content["createFolderButton.label"]}
				</span>
			</SecondaryButton>
		</>
	);
};
