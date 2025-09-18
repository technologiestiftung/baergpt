import React from "react";
import { ChatSection } from "../components/chat/chat-section.tsx";
import { AppLayout } from "../layouts/app-layout.tsx";
import { DocumentsSection } from "../components/documents/documents-section.tsx";
import { useAuthStore } from "../store/auth-store.ts";
import { DocumentPreviewSection } from "../components/documents/document-preview-section.tsx";
import { MobileHistoryDrawer } from "../components/sidebar/history/mobile-history-drawer.tsx";
import { MobileProfileDrawer } from "../components/profile/mobile-profile-drawer.tsx";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

export const IndexPage: React.FC = () => {
	const { session } = useAuthStore();

	return (
		<AppLayout>
			<div className="relative flex flex-row h-full w-full">
				{session && (
					<DndProvider backend={HTML5Backend}>
						<MobileHistoryDrawer />
						<DocumentsSection />
						<MobileProfileDrawer />
						<div className="relative flex-1">
							<ChatSection />
							<DocumentPreviewSection />
						</div>
					</DndProvider>
				)}
			</div>
		</AppLayout>
	);
};
