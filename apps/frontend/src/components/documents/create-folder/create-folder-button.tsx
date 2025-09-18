import React from "react";
import {
	CreateFolderDialog,
	showCreateFolderDialog,
} from "./create-folder-dialog";
import { useFolderStore } from "../../../store/folder-store";
import { SecondaryButton } from "../../primitives/buttons/secondary-button.tsx";
import { PlusIcon } from "../../primitives/icons/plus-icon.tsx";
import Content from "../../../content.ts";

export const CreateFolderButton: React.FC = () => {
	const { currentFolder } = useFolderStore();

	return (
		<>
			<SecondaryButton
				onClick={showCreateFolderDialog}
				disabled={currentFolder !== null}
			>
				<span className="whitespace-nowrap">
					{Content["createFolderButton.label"]}
				</span>
				<PlusIcon enabled={currentFolder === null} />
			</SecondaryButton>

			<CreateFolderDialog />
		</>
	);
};
