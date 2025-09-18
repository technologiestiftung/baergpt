import { BottomDrawer } from "../primitives/bottom-drawer/bottom-drawer.tsx";
import { useDrawerStore } from "../../store/drawer-store.ts";
import DocumentBreadcrumbs from "./document-breadcrumbs.tsx";
import { DocumentsList } from "./document-list/documents-list.tsx";
import { SecondaryButton } from "../primitives/buttons/secondary-button.tsx";
import { CheckboxIcon } from "../primitives/icons/checkbox-icon.tsx";
import { CloseIcon } from "../primitives/icons/close-icon.tsx";
import { DeleteItemButton } from "./delete-item/delete-item-button.tsx";
import { useMobileMenuStore } from "../../store/use-mobile-menu.ts";
import Content from "../../content.ts";

export function MobileDocuments({ hasItems }: { hasItems: boolean }) {
	const { openDrawerId, setOpenDrawer } = useDrawerStore();
	const isDocumentsSectionOpen = openDrawerId === "documents";
	const { isMobileCheckboxVisible, toggleIsMobileCheckboxVisible } =
		useMobileMenuStore();

	const handleToggle = () => {
		setOpenDrawer(isDocumentsSectionOpen ? null : "documents");
	};

	return (
		<BottomDrawer
			isOpen={isDocumentsSectionOpen}
			onClose={handleToggle}
			title={Content["documentsToggleButton.label"]}
			classNames="md:hidden"
		>
			<div className="mt-11 px-5">
				<DocumentBreadcrumbs />
			</div>

			{hasItems && (
				<div className="flex h-full px-5 mt-3 md:mt-0">
					<DocumentsList />
				</div>
			)}

			<div className="flex md:hidden px-4 gap-x-4 pb-6">
				{!isMobileCheckboxVisible && (
					<SecondaryButton onClick={toggleIsMobileCheckboxVisible}>
						{Content["documentsSection.selectFiles"]}{" "}
						<CheckboxIcon state="checked" />
					</SecondaryButton>
				)}

				{isMobileCheckboxVisible && (
					<>
						<SecondaryButton onClick={toggleIsMobileCheckboxVisible}>
							{Content["fileUpload.cancel"]} <CloseIcon />
						</SecondaryButton>

						<DeleteItemButton id="mobile" />
					</>
				)}
			</div>
		</BottomDrawer>
	);
}
