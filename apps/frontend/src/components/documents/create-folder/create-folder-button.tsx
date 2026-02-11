import React from "react";
import { showCreateFolderDialog } from "./create-folder-dialog";
import { useFolderStore } from "../../../store/folder-store";
import { SecondaryButton } from "../../primitives/buttons/secondary-button.tsx";
import Content from "../../../content.ts";
import { FolderIcon } from "../../primitives/icons/folder-icon.tsx";

export const CreateFolderButton: React.FC = () => {
	const { currentFolder } = useFolderStore();

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
