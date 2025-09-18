import React from "react";
import { useDrawerStore } from "../../../store/drawer-store";
import Content from "../../../content";
import { DocumentIcon } from "../../primitives/icons/document-icon";

export const DocumentsToggleButton: React.FC = () => {
	const { openDrawerId, setOpenDrawer } = useDrawerStore();
	const isDocumentsSectionOpen = openDrawerId === "documents";

	const handleToggle = () => {
		setOpenDrawer(isDocumentsSectionOpen ? null : "documents");
	};

	return (
		<button
			aria-label={
				isDocumentsSectionOpen
					? Content["documentsToggleButton.arialabel.close"]
					: Content["documentsToggleButton.arialabel.open"]
			}
			className={`relative flex flex-col items-center justify-center gap-1 md:gap-1 size-[52px] p-2 rounded-[3px] focus-visible:outline-default ${isDocumentsSectionOpen ? "bg-hellblau-50 text-dunkelblau-100" : "text-hellblau-50"}`}
			onClick={handleToggle}
		>
			<>
				{isDocumentsSectionOpen ? (
					<DocumentIcon variant="darkBlue" />
				) : (
					<DocumentIcon variant="white" />
				)}
				<span className="text-sm leading-5 font-normal md:hidden">
					{Content["documentsToggleButton.label"]}
				</span>
			</>
		</button>
	);
};
